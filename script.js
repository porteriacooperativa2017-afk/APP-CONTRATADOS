let qrValidado = false;
let html5QrCode;

function iniciarEscaneo() {
    const dniVal = document.getElementById('dni').value;
    if (!dniVal) {
        alert("Por favor, ingrese su DNI antes de validar.");
        return;
    }

    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = 'block';
    
    // Configuramos el lector con mayor sensibilidad
    html5QrCode = new Html5Qrcode("reader");
    
    const config = { 
        fps: 20, // Más frames por segundo para capturar rápido
        qrbox: { width: 280, height: 280 }, // Cuadro de escaneo más grande
        aspectRatio: 1.0 
    };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (textoDetectado) => {
            // Convertimos a mayúsculas para evitar errores de coincidencia
            if(textoDetectado.toUpperCase().trim() === "GUARDIA-COFARMEN") {
                qrValidado = true;
                document.getElementById('acciones').style.display = 'block';
                document.getElementById('seccion-dni').style.display = 'none';
                document.getElementById('reader').style.display = 'none';
                document.getElementById('mensaje').innerText = "QR Validado.";
                document.getElementById('mensaje').style.color = "green";
                html5QrCode.stop().catch(err => console.error(err));
            }
        }
    ).catch((err) => {
        alert("Error al iniciar cámara: " + err);
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
