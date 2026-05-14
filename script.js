let qrValidado = false;
let html5QrCode;

function iniciarEscaneo() {
    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = 'block';
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (qrCodeMessage) => {
            if(qrCodeMessage === "GUARDIA-COFARMEN") {
                qrValidado = true;
                document.getElementById('acciones').style.display = 'block';
                document.getElementById('seccion-dni').style.display = 'none';
                readerDiv.style.display = 'none';
                document.getElementById('mensaje').innerText = "QR Validado Correctamente.";
                html5QrCode.stop();
            }
        },
        (errorMessage) => { /* Escaneando... */ }
    ).catch((err) => {
        alert("Error al iniciar cámara. Verifique permisos.");
        console.error(err);
    });
}

function registrarMovimiento() {
    const dniU = document.getElementById('dni').value;
    const evento = document.getElementById('tipo-evento').value;

    if (!dniU || !qrValidado) {
        alert("Falta DNI o validación de QR.");
        return;
    }

    navigator.geolocation.getCurrentPosition((pos) => {
        const payload = {
            data: [{
                "fecha y hora": new Date().toLocaleString('es-AR'),
                "nombre": "Personal Cofarmen",
                "dni": dniU,
                "ingreso": (evento === "INGRESO") ? new Date().toLocaleTimeString('es-AR') : "",
                "inicio de pausa": (evento === "INICIO PAUSA") ? new Date().toLocaleTimeString('es-AR') : "",
                "fin de pausa": (evento === "REGRESO PAUSA") ? new Date().toLocaleTimeString('es-AR') : "",
                "egreso": (evento === "EGRESO") ? new Date().toLocaleTimeString('es-AR') : "",
                "total horas": "",
                "distancia": ${pos.coords.latitude}, ${pos.coords.longitude}
            }]
        };

        fetch('https://sheetdb.io/api/v1/fV-neQdPCZCPaNbe45TFv8lg7pvmi1GeGcMTn5pyERk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(result => {
            document.getElementById('mensaje').style.color = "green";
            document.getElementById('mensaje').innerText = "¡Registro guardado en Mendoza!";
            setTimeout(() => location.reload(), 3000);
        })
        .catch(error => {
            alert("Error al conectar con la hoja de cálculo.");
            console.error(error);
        });

    }, (error) => {
        alert("Debe activar el GPS para registrar su ubicación en planta.");
    });
}
async function registrarAutomatico(dniU) {
    const url = 'https://sheetdb.io/api/v1/fV-neQdPCZCPaNbe45TFv8lg7pvmi1GeGcMTn5pyERk';
    const hoy = new Date().toLocaleDateString('es-AR');
    
    try {
        // Consultamos qué registros tiene este DNI hoy
        const res = await fetch(${url}/search?dni=${dniU});
        const datos = await res.json();
        const registrosHoy = datos.filter(r => r["fecha y hora"] && r["fecha y hora"].includes(hoy));
        
        let payload = {
            "fecha y hora": new Date().toLocaleString('es-AR'),
            "nombre": "Personal Planta",
            "dni": dniU
        };

        // Lógica de 4 pasos para tu Hoja 1
        if (registrosHoy.length === 0) {
            payload["ingreso"] = new Date().toLocaleTimeString('es-AR');
        } else if (registrosHoy.length === 1) {
            payload["inicio de pausa"] = new Date().toLocaleTimeString('es-AR');
        } else if (registrosHoy.length === 2) {
            payload["fin de pausa"] = new Date().toLocaleTimeString('es-AR');
        } else if (registrosHoy.length === 3) {
            payload["egreso"] = new Date().toLocaleTimeString('es-AR');
        } else {
            alert("Ya completó los 4 movimientos del día.");
            location.reload();
            return;
        }

        // Ubicación y envío final
        navigator.geolocation.getCurrentPosition(async (pos) => {
            payload["distancia"] = pos.coords.latitude + ", " + pos.coords.longitude;
            
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: [payload] })
            });

            alert("¡Registro automático guardado!");
            location.reload();
        }, () => alert("GPS obligatorio para registrarse."));

    } catch (e) {
        alert("Error de conexión con la planilla.");
    }
}
