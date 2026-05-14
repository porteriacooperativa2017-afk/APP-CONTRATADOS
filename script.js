let html5QrCode;
const urlAPI = 'https://sheetdb.io/api/v1/fV-neQdPCZCPaNbe45TFv8lg7pvmi1GeGcMTn5pyERk';

async function procesarAsistencia() {
    const dni = document.getElementById('dni').value;
    const pin = document.getElementById('pin').value;

    if (!dni || !pin) {
        alert("Por favor, complete DNI y PIN.");
        return;
    }

    try {
        const hoy = new Date().toLocaleDateString('es-AR');
        const res = await fetch(${urlAPI}/search?dni=${dni});
        const datos = await res.json();
        const registrosHoy = datos.filter(r => r["fecha y hora"] && r["fecha y hora"].includes(hoy));

        // LÓGICA:
        // 0 registros = INGRESO (Directo)
        // 1 o 2 registros = PAUSAS (Requiere QR)
        // 3 registros = EGRESO (Directo)

        if (registrosHoy.length === 0 || registrosHoy.length === 3) {
            enviarDatos(dni, registrosHoy.length);
        } else {
            alert("Este movimiento requiere escaneo de QR en Guardia.");
            iniciarEscaneoQR(dni, registrosHoy.length);
        }
    } catch (e) {
        alert("Error al conectar con el sistema.");
    }
}

function iniciarEscaneoQR(dni, cantidad) {
    document.getElementById('reader').style.display = 'block';
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        async (texto) => {
            if(texto.toUpperCase().includes("GUARDIA")) {
                await html5QrCode.stop();
                document.getElementById('reader').style.display = 'none';
                enviarDatos(dni, cantidad);
            }
        }
    ).catch(err => alert("Error de cámara. Verifique permisos."));
}

function enviarDatos(dni, cantidad) {
    let columna = "";
    if (cantidad === 0) columna = "ingreso";
    else if (cantidad === 1) columna = "inicio de pausa";
    else if (cantidad === 2) columna = "fin de pausa";
    else if (cantidad === 3) columna = "egreso";

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const payload = {
            data: [{
                "fecha y hora": new Date().toLocaleString('es-AR'),
                "dni": dni,
                "nombre": "Personal Planta",
                [columna]: new Date().toLocaleTimeString('es-AR'),
                "distancia": ${pos.coords.latitude}, ${pos.coords.longitude}
            }]
        };

        const response = await fetch(urlAPI, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("Movimiento registrado con éxito.");
            location.reload();
        }
    }, () => alert("GPS obligatorio para registrar asistencia."));
}
