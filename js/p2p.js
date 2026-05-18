// Serverless peer-to-peer over WebRTC. Manual (copy/paste) signaling, public
// STUN only — NO signaling server, NO TURN, no infrastructure we run. The
// document is sent directly browser-to-browser to the invited party; it never
// passes through any server (there is none).
//
// Strict layering: this module has NO DOM and NO storage. It exposes a small
// callback API; js/app.js does all wiring. Keep it that way.
//
// No-trickle ICE: with no signaling channel we cannot stream ICE candidates,
// so we wait for gathering to finish and embed everything in one self-contained
// invite/answer blob the user copies out-of-band.

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// Unicode-safe base64 of a JSON description.
function enc(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function dec(code) {
  return JSON.parse(decodeURIComponent(escape(atob(String(code).trim()))));
}

// Pull the public IP a STUN server observed for an endpoint, out of an SDP's
// server-reflexive (srflx) ICE candidate. Host candidates are skipped (modern
// browsers mDNS-obfuscate the LAN IP to `*.local`); srflx is the real public
// IP as seen by the neutral STUN server. Returns "" if none (e.g. STUN blocked).
function srflxIP(sdp) {
  if (!sdp) return "";
  const lines = String(sdp).split(/\r?\n/);
  for (const ln of lines) {
    const m = ln.match(/^a=candidate:\S+ \d+ \S+ \d+ (\S+) \d+ typ srflx/i);
    if (m && m[1] && !/\.local$/i.test(m[1])) return m[1];
  }
  return "";
}

function iceComplete(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") finish();
    });
    pc.addEventListener("icecandidate", (e) => {
      if (!e.candidate) finish();
    });
    // Ship whatever candidates we have rather than hang forever on odd networks.
    setTimeout(finish, 4000);
  });
}

// role: "drafter" (creates the invite) | "signer" (accepts it).
// onState(state): "connecting" | "connected" | "disconnected" | "failed" | "closed"
// onMessage(obj): parsed application message from the peer.
export function createSession({ role, onState, onMessage }) {
  const pc = new RTCPeerConnection(ICE);
  let chan = null;
  const state = (s) => onState && onState(s);

  function bind(ch) {
    chan = ch;
    ch.onopen = () => state("connected");
    ch.onclose = () => state("closed");
    ch.onmessage = (e) => {
      try {
        onMessage && onMessage(JSON.parse(e.data));
      } catch {
        /* ignore malformed frames */
      }
    };
  }

  pc.onconnectionstatechange = () => {
    const cs = pc.connectionState;
    if (cs === "failed") state("failed");
    else if (cs === "disconnected") state("disconnected");
    else if (cs === "closed") state("closed");
  };

  if (role === "drafter") {
    bind(pc.createDataChannel("foolscap"));
  } else {
    pc.ondatachannel = (e) => bind(e.channel);
  }

  return {
    role,

    // Drafter: produce the invite blob to send to the signer out-of-band.
    async createInvite() {
      state("connecting");
      await pc.setLocalDescription(await pc.createOffer());
      await iceComplete(pc);
      return enc(pc.localDescription);
    },

    // Signer: consume the invite, return the answer blob to send back.
    async acceptInvite(code) {
      state("connecting");
      await pc.setRemoteDescription(dec(code));
      await pc.setLocalDescription(await pc.createAnswer());
      await iceComplete(pc);
      return enc(pc.localDescription);
    },

    // Drafter: consume the signer's answer; connection then establishes.
    async acceptAnswer(code) {
      await pc.setRemoteDescription(dec(code));
    },

    // This endpoint's own public IP, as the STUN server saw it (srflx).
    localIP() {
      return srflxIP(pc.localDescription && pc.localDescription.sdp);
    },
    // The peer's public IP, observed independently from the handshake SDP
    // they sent us — lets us cross-check the IP they self-report.
    remoteIP() {
      return srflxIP(pc.remoteDescription && pc.remoteDescription.sdp);
    },

    send(obj) {
      if (chan && chan.readyState === "open") {
        chan.send(JSON.stringify(obj));
      }
    },

    close() {
      try {
        if (chan) chan.close();
      } catch {
        /* noop */
      }
      try {
        pc.close();
      } catch {
        /* noop */
      }
      state("closed");
    },
  };
}
