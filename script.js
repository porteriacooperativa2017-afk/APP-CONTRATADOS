let qrValidado = false;
let html5QrCode;

function iniciarEscaneo() {
    const dniInput = document.getElementById('dni');
    if (!dniInput.value) {
        alert("Por favor, ingrese su DNI primero.");
        return;
    }

    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = 'block';
    
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        (qrCodeMessage) => {
            if(qrCodeMessage === "GUARDIA-COFARMEN") {
                qrValidado = true;
                document.getElementById('acciones').style.display = 'block';
                document.getElementById('seccion-dni').style.display = 'none';
                readerDiv.style.display = 'none';
                document.getElementById('mensaje').innerText = "QR Validado.";
                html5QrCode.stop();
            }
        },
        () => { /* Escaneando... */ }
    ).catch((err) => {
        console.error(err);
        alert("Active la cámara o use una conexión segura (HTTPS).");
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
        .then((res) => res.json())
        .then(() => {
            alert("¡Registro guardado con éxito!");
            location.reload();
        })
        .catch(() => {
            alert("Error al conectar con la planilla.");
        });
    }, () => {
        alert("El GPS es obligatorio para registrarse.");
    });
}
