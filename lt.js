const localtunnel = require('localtunnel');

(async () => {
  const startTunnel = async () => {
    
    const tunnel = await localtunnel({ port: 5000, subdomain: 'synibackend' }); // facultatif
    console.log(`✅ Tunnel en ligne : ${tunnel.url}`);

    tunnel.on('close', () => {
      console.log('❌ Tunnel fermé, reconnexion...');
      startTunnel();
    });
  };

  startTunnel();
})();
