let html5QrCode;

function iniciarEscaneo() {
    const dniVal = document.getElementById('dni').value;
    if (!dniVal) {
        alert("Por favor, ingrese su DNI.");
        return;
    }

    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = 'block';
    
    // Esta es la configuración exacta que ya te funcionaba para abrir la cámara
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        async (qrCodeMessage) => {
            const limpio = qrCodeMessage.toUpperCase().trim();
            // Aceptamos tanto el guion bajo como el medio para evitar errores en planta
            if(limpio.includes("GUARDIA_COFARMEN") || limpio.includes("GUARDIA-COFARMEN")) {
                await html5QrCode.stop();
                document.getElementById('reader').style.display = 'none';
                // Ejecutamos la lógica de registro automático
                registrarAutomatico(dniVal);
            }
        },
        (errorMessage) => { /* Escaneando... */ }
    ).catch((err) => {
        alert("Error de cámara. Asegúrese de dar permisos y usar HTTPS.");
    });
}

async function registrarAutomatico(dniU) {
    const url = 'https://sheetdb.io/api/v1/fV-neQdPCZCPaNbe45TFv8lg7pvmi1GeGcMTn5pyERk';
    const hoy = new Date().toLocaleDateString('es-AR');
    
    try {
        // Consultamos registros previos para automatizar el estado
        const res = await fetch(${url}/search?dni=${dniU});
        const datos = await res.json();
        
        // Filtramos para contar solo los movimientos de hoy
        const registrosHoy = datos.filter(r => r["fecha y hora"] && r["fecha y hora"].includes(hoy));
        
        let payload = {
            "fecha y hora": new Date().toLocaleString('es-AR'),
            "nombre": "Personal Planta",
            "dni": dniU
        };

        // Lógica automática: 1er escaneo=Ingreso, 2do=Pausa, 3ero=Regreso, 4to=Egreso
        if (registrosHoy.length === 0) {
            payload["ingreso"] = new Date().toLocaleTimeString('es-AR');
        } else if (registrosHoy.length === 1) {
            payload["inicio de pausa"] = new Date().toLocaleTimeString('es-AR');
        } else if (registrosHoy.length === 2) {
            payload["fin de pausa"] = new Date().toLocaleTimeString('es-AR');
        } else if (registrosHoy.length === 3) {
            payload["egreso"] = new Date().toLocaleTimeString('es-AR');
        } else {
            alert("Ya se completaron los registros diarios para este DNI.");
            location.reload();
            return;
        }

        // Captura de ubicación obligatoria para Cofarmen
        navigator.geolocation.getCurrentPosition(async (pos) => {
            payload["distancia"] = pos.coords.latitude + ", " + pos.coords.longitude;
            
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: [payload] })
            });

            alert("Registro automático guardado con éxito.");
            location.reload();
        }, () => {
            alert("Debe activar el GPS para registrar su movimiento.");
        });

    } catch (e) {
        alert("Error al conectar con la planilla de registros.");
    }
}
