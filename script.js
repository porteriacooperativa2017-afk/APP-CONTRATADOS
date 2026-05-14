
let html5QrCode;

async function iniciarEscaneo() {
    const dniVal = document.getElementById('dni').value;
    if (!dniVal) {
        alert("Por favor, ingrese su DNI.");
        return;
    }
    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = 'block';
    
    // Reiniciamos el objeto para evitar conflictos de memoria
    if (html5QrCode) {
        await html5QrCode.clear();
    }
    
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 20, qrbox: 250 },
        async (texto) => {
            const limpio = texto.toUpperCase().trim();
            // Acepta el guion bajo que ya tenés impreso en la guardia
            if(limpio.includes("GUARDIA_COFARMEN") || limpio.includes("GUARDIA-COFARMEN")) {
                await html5QrCode.stop();
                document.getElementById('reader').style.display = 'none';
                determinarYRegistrar(dniVal);
            }
        }
    ).catch(err => {
        alert("Error de cámara: Asegúrese de usar HTTPS y dar permisos.");
        console.error(err);
    });
}

async function determinarYRegistrar(dniU) {
    const url = 'https://sheetdb.io/api/v1/fV-neQdPCZCPaNbe45TFv8lg7pvmi1GeGcMTn5pyERk';
    const hoy = new Date().toLocaleDateString('es-AR');
    
    try {
        const res = await fetch(${url}/search?dni=${dniU});
        const datos = await res.json();
        // Filtramos registros de hoy para el sistema automático
        const registrosHoy = datos.filter(r => r["fecha y hora"] && r["fecha y hora"].includes(hoy));
        
        let payload = {
            "fecha y hora": new Date().toLocaleString('es-AR'),
            "nombre": "Personal Planta",
            "dni": dniU
        };

        // Lógica de 4 pasos: Ingreso -> Pausa -> Regreso -> Egreso
        if (registrosHoy.length === 0) {
            payload["ingreso"] = new Date().toLocaleTimeString('es-AR');
        } else if (registrosHoy.length === 1) {
            payload["inicio de pausa"] = new Date().toLocaleTimeString('es-AR');
        } else if (registrosHoy.length === 2) {
            payload["fin de pausa"] = new Date().toLocaleTimeString('es-AR');
        } else if (registrosHoy.length === 3) {
            payload["egreso"] = new Date().toLocaleTimeString('es-AR');
        } else {
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

            alert("¡Registro automático exitoso!");
            location.reload();
        }, () => alert("El GPS es obligatorio para Cofarmen."));

    } catch (e) {
        alert("Error al conectar con la base de datos.");
    }
}
