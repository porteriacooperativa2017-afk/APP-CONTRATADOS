const API_URL = "https://sheetdb.io/api/v1/0r37mye22zrgm"; 

var listaPersonal = [];
var qrValidado = false; // Bloqueo de seguridad

window.onload = function() {
    // Carga de datos con mayúsculas exactas (DNI, NOMBRE COMPLETO, CONTRASEÑA)
    fetch(API_URL + "?sheet=Respuestas de formulario 1")
        .then(res => res.json())
        .then(data => {
            listaPersonal = data.map(fila => ({
                dni: String(fila["DNI"] || "").trim(),
                nombre: String(fila["NOMBRE COMPLETO"] || "").trim(),
                pin: String(fila["CONTRASEÑA"] || "").trim()
            }));
        })
        .catch(err => console.error("Error al sincronizar personal"));
};

// El empleado escanea el código fijo de la guardia
document.getElementById('btn-scan').onclick = function() {
    const reader = new Html5Qrcode("reader");
    reader.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        function(texto) {
            // Aquí podés validar que el texto del QR sea uno específico de la guardia
            qrValidado = true; 
            reader.stop();
            document.getElementById('btn-scan').innerText = "✅ UBICACIÓN VALIDADA EN GUARDIA";
            document.getElementById('btn-scan').style.background = "#c8e6c9";
        }
    ).catch(err => {
        alert("Error de cámara: En modo prueba (PC) la cámara puede fallar. En el celular funcionará con HTTPS.");
    });
};

document.getElementById('btn-registrar').onclick = function() {
    const dniU = document.getElementById('dni').value.trim();
    const pinU = document.getElementById('pass').value.trim();
    const evento = document.getElementById('tipo-evento').value;

    // Validación de Identidad (DNI y PIN)
    const usuario = listaPersonal.find(u => 
        parseInt(u.dni) === parseInt(dniU) && String(u.pin) === String(pinU)
    );

    if (!usuario) {
        alert("DNI o CONTRASEÑA INCORRECTOS");
        return;
    }

    // BLOQUEO CRÍTICO: Si el empleado no escaneó el QR de la guardia, no pasa
    if (!qrValidado) {
        alert("ERROR: Debes escanear el código QR ubicado en la guardia para continuar.");
        return;
    }

    document.getElementById('btn-registrar').disabled = true;

    navigator.geolocation.getCurrentPosition(function(pos) {
        const payload = {
            data: [{
                "Marca Temporal": new Date().toLocaleString('es-AR'),
                "DNI": dniU,
                "Nombre Completo": usuario.nombre,
                "Estado": evento,
                "Ubicacion": pos.coords.latitude + ", " + pos.coords.longitude,
                "Validacion QR": "ESCANEADO EN GUARDIA"
            }]
        };

        fetch(API_URL + "?sheet=Hoja 1", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (res.ok) {
                alert("REGISTRO EXITOSO: " + evento);
                location.reload();
            }
        });
    }, function() {
        alert("El GPS es obligatorio para validar la posición en la planta.");
        document.getElementById('btn-registrar').disabled = false;
    });
};