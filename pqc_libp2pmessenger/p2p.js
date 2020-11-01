const Libp2p = require("libp2p");
const TCP = require("libp2p-tcp");
const Mplex = require("libp2p-mplex");
const SECIO = require("libp2p-secio");
const PeerInfo = require("peer-info");
const Gossipsub = require("libp2p-gossipsub");
const readline = require("readline");

// Topic for the pub/sub channel.
const topic = "news";

// Peer addresses to bootstrap the network.
peersList = process.argv.slice(2);

// Create a stdin interface to send messages.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

const createNode = async () => {
  // Create a multihash address.
  const peerInfo = await PeerInfo.create();
  peerInfo.multiaddrs.add("/ip4/0.0.0.0/tcp/0");

  // Create a Libp2p node.
  const node = await Libp2p.create({
    peerInfo,
    modules: {
      transport: [TCP],
      streamMuxer: [Mplex],
      connEncryption: [SECIO],
      pubsub: Gossipsub
    },
    config: {
      pubsub: {
        enabled: true,
        emitSelf: false
      }
    }
  });

  await node.start();
  return node;
};

(async () => {
  // Setup identity.
  node = await createNode();
  myPeerId = node.peerInfo.id.toB58String();
  console.log(`Your peer id is: ${myPeerId}`);
  console.log("listening on:");
  node.peerInfo.multiaddrs.forEach(ma =>
    console.log(ma.toString() + "/p2p/" + myPeerId)
  );

  if (peersList.length > 0) {
    let isConnected = false;
    await Promise.all(
      peersList.map(async peerId => {
        try {
          await node.dial(peerId);
          isConnected = true;
          console.log(`Connected to ${peerId}!`);
        } catch (_) {
          console.log(`Unable to connect to ${peerId}.`);
        }
      })
    );
    if (!isConnected) {
      console.log("Unable to connect to network.");
    }
  } else {
    console.log("Waiting for connections (root node).");
  }

  // Subscribe to channel.
  await node.pubsub.subscribe(topic, ({ from, data }) => {
    console.log(`${from}: ${data.toString()}`);
  });

  // Broadcast console input to channel.
  rl.on("line", line => {
    node.pubsub.publish(topic, Buffer.from(line));
  });
})();
