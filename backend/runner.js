try {
  console.log("Loading server.js...");
  require('./server.js');
} catch (e) {
  console.error("FATAL ERROR:", e);
}
