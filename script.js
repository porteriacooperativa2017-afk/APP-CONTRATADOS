let qrValidado = false;
let html5QrCode;

function iniciarEscaneo() {
    const dniVal = document.getElementById('dni').value;
    if (!dniVal) {
        alert("Por favor, ingrese su DNI.");
        return;
    }

    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = 'block';
    
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        (mensaje) => {
            if(mensaje === "GUARDIA-COFARMEN") {
                qrValidado = true;
                document.getElementById('acciones').style.display = 'block';
                document.getElementById('seccion-dni').style.display = 'none';
                document.getElementById('reader').style.display = 'none';
                document.getElementById('mensaje').innerText = "QR OK. Elija movimiento.";
                html5QrCode.stop();
            }
        },
        (error) => { /* buscando qr... */ }
    ).catch((err) => {
        alert("Error de cámara: Verifique permisos de navegador.");
    });
}

function registrarMovimiento() {
    const dniU = document.getElementById('dni').value;
    const evento = document.getElementById('tipo-evento').value;

    navigator.geolocation.getCurrentPosition((pos) => {
        const payload = {
            data: [{
                "fecha y hora": new Date().toLocaleString('es-AR'),
                "nombre": "Personal Planta",
                "dni": dniU,
                "ingreso": (evento === "INGRESO") ? new Date().toLocaleTimeString('es-AR') : "",
                "inicio de pausa": (evento === "INICIO PAUSA") ? new Date().toLocaleTimeString('es-AR') : "",
                "fin de pausa": (evento === "REGRESO PAUSA") ? new Date().toLocaleTimeString('es-AR') : "",
                "egreso": (evento === "EGRESO") ? new Date().toLocaleTimeString('es-AR') : "",
                "total horas": "", 
                "distancia": pos.coords.latitude + ", " + pos.coords.longitude
            }]
        };

        fetch('https://sheetdb.io/api/v1/fV-neQdPCZCPaNbe45TFv8lg7pvmi1GeGcMTn5pyERk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(() => {
            alert("¡Registro guardado!");
            location.reload();
        })
        .catch(() => alert("Error de red."));
    }, () => {
        alert("Active el GPS para registrarse.");
    });
}
