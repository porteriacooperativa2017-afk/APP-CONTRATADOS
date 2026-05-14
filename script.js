let html5QrCode;
const urlAPI = 'https://sheetdb.io/api/v1/fV-neQdPCZCPaNbe45TFv8lg7pvmi1GeGcMTn5pyERk';

async function procesarAsistencia() {
    const dni = document.getElementById('dni').value;
    const pin = document.getElementById('pin').value;

    if (!dni || !pin) {
        alert("Por favor, ingrese DNI y PIN.");
        return;
    }

    try {
        const hoy = new Date().toLocaleDateString('es-AR');
        const res = await fetch(${urlAPI}/search?dni=${dni});
        const datos = await res.json();
        
        // Identificar movimientos del día
        const registrosHoy = datos.filter(r => r["fecha y hora"] && r["fecha y hora"].includes(hoy));
        const cantidad = registrosHoy.length;

        // Lógica: 0 (Ingreso) y 3 (Egreso) son directos. 1 y 2 (Pausas) requieren QR.
        if (cantidad === 0 || cantidad === 3) {
            enviarDatos(dni, cantidad);
        } else {
            alert("Para registrar la pausa debe escanear el QR en Guardia.");
            iniciarEscaneoSeguridad(dni, cantidad);
        }
    } catch (e) {
        alert("Error al conectar con la base de datos de MOVIMIENTOS.");
    }
}

function iniciarEscaneoSeguridad(dni, cantidad) {
    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = 'block';
    
    html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        async (codigo) => {
            if(codigo.toUpperCase().includes("GUARDIA")) {
                await html5QrCode.stop();
                readerDiv.style.display = 'none';
                enviarDatos(dni, cantidad);
            }
        }
    ).catch(err => alert("Error al activar la cámara."));
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
            alert("Movimiento registrado: " + columna.toUpperCase());
            location.reload();
        }
    }, () => alert("El uso de GPS es obligatorio para registrarse en Cofarmen."));
}
