let html5QrCode;

async function iniciarEscaneo() {
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
        { fps: 20, qrbox: 250 },
        async (texto) => {
            const limpio = texto.toUpperCase().trim();
            // Acepta el guion bajo que generaste para la guardia
            if(limpio.includes("GUARDIA_COFARMEN") || limpio.includes("GUARDIA-COFARMEN")) {
                await html5QrCode.stop();
                document.getElementById('reader').style.display = 'none';
                determinarYRegistrar(dniVal);
            }
        }
    ).catch(err => alert("Error de cámara: " + err));
}

async function determinarYRegistrar(dniU) {
    const url = 'https://sheetdb.io/api/v1/fV-neQdPCZCPaNbe45TFv8lg7pvmi1GeGcMTn5pyERk';
    const hoy = new Date().toLocaleDateString('es-AR');
    
    try {
        // Buscamos si el DNI ya tiene registros hoy
        const res = await fetch(${url}/search?dni=${dniU});
        const datos = await res.json();
        const registrosHoy = datos.filter(r => r["fecha y hora"] && r["fecha y hora"].includes(hoy));
        
        let payload = {
            "fecha y hora": new Date().toLocaleString('es-AR'),
            "nombre": "Personal Planta",
            "dni": dniU
        };

        // Lógica automática basada en la cantidad de registros
        if (registrosHoy.length === 0) {
            payload["ingreso"] = new Date().toLocaleTimeString('es-AR');
        } else if (registrosHoy.length === 1) {
            payload["inicio de pausa"] = new Date().toLocaleTimeString('es-AR');
        } else if (registrosHoy.length === 2) {
            payload["fin de pausa"] = new Date().toLocaleTimeString('es-AR');
        } else if (registrosHoy.length === 3) {
            payload["egreso"] = new Date().toLocaleTimeString('es-AR');
        } else {
            alert("Ya se completaron los 4 registros del día.");
            location.reload();
            return;
        }

        // Obtener ubicación y enviar a SheetDB
        navigator.geolocation.getCurrentPosition(async (pos) => {
            payload["distancia"] = ${pos.coords.latitude}, ${pos.coords.longitude};
            
            const postRes = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: [payload] })
            });

            if (postRes.ok) {
                alert("Registro completado con éxito.");
                location.reload();
            }
        }, () => alert("El GPS es obligatorio para registrarse."));

    } catch (e) {
        alert("Error de conexión con la planilla.");
    }
}
