let html5QrCode;

function iniciarEscaneo() {
    const dniVal = document.getElementById('dni').value;
    if (!dniVal) {
        alert("Por favor, ingrese su DNI.");
        return;
    }
    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = 'block';
    
    // Volvemos a la configuración simple que te funcionó al principio
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        async (texto) => {
            const limpio = texto.toUpperCase().trim();
            // Aceptamos cualquier variante de tu QR de guardia
            if(limpio.includes("GUARDIA")) {
                await html5QrCode.stop();
                document.getElementById('reader').style.display = 'none';
                // Ejecutamos el registro automático
                registrarAutomatico(dniVal);
            }
        }
    ).catch(err => {
        alert("Error: Verifique permisos de cámara en el navegador.");
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
