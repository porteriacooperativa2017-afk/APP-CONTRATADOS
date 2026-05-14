let html5QrCode;

function iniciarEscaneo() {
    const dniVal = document.getElementById('dni').value;
    if (!dniVal) {
        alert("Por favor, ingrese su DNI.");
        return;
    }

    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = 'block';
    
    // RESTAURADO: Motor de cámara que te funcionó anteriormente
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        async (qrCodeMessage) => {
            const limpio = qrCodeMessage.toUpperCase().trim();
            // Acepta guion bajo o medio según el QR que tengas impreso
            if(limpio.includes("GUARDIA_COFARMEN") || limpio.includes("GUARDIA-COFARMEN")) {
                await html5QrCode.stop();
                document.getElementById('reader').style.display = 'none';
                registrarMovimientoAutomatico(dniVal);
            }
        },
        (errorMessage) => { /* Buscando QR... */ }
    ).catch((err) => {
        alert("Error de cámara: Verifique permisos y conexión HTTPS.");
    });
}

async function registrarMovimientoAutomatico(dniU) {
    const url = 'https://sheetdb.io/api/v1/fV-neQdPCZCPaNbe45TFv8lg7pvmi1GeGcMTn5pyERk';
    const hoy = new Date().toLocaleDateString('es-AR');
    document.getElementById('mensaje').innerText = "Procesando...";

    try {
        const res = await fetch(${url}/search?dni=${dniU});
        const datos = await res.json();
        const registrosHoy = datos.filter(r => r["fecha y hora"] && r["fecha y hora"].includes(hoy));
        
        let payload = {
            "fecha y hora": new Date().toLocaleString('es-AR'),
            "nombre": "Personal Planta",
            "dni": dniU
        };

        // Lógica de 4 pasos automática para tu planilla
        if (registrosHoy.length === 0) payload["ingreso"] = new Date().toLocaleTimeString('es-AR');
        else if (registrosHoy.length === 1) payload["inicio de pausa"] = new Date().toLocaleTimeString('es-AR');
        else if (registrosHoy.length === 2) payload["fin de pausa"] = new Date().toLocaleTimeString('es-AR');
        else if (registrosHoy.length === 3) payload["egreso"] = new Date().toLocaleTimeString('es-AR');
        else {
            alert("Ya completó los registros de hoy.");
            location.reload();
            return;
        }

        navigator.geolocation.getCurrentPosition(async (pos) => {
            payload["distancia"] = ${pos.coords.latitude}, ${pos.coords.longitude};
            
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: [payload] })
            });

            alert("Registro guardado con éxito en la planilla.");
            location.reload();
        }, () => alert("GPS obligatorio para registrar ubicación en Mendoza."));

    } catch (e) {
        alert("Error de conexión con SheetDB.");
    }
}
