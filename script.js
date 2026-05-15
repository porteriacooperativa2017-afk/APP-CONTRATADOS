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
var html5QrCode = null;
// Mantenemos tu API original
var urlBase = 'https://sheetdb.io/api/v1/0r37mye22zrgm';
// Forzamos Hoja 1. OJO: Si tu pestaña se llama "Hoja 1" (con espacio), debe ir Hoja%201
var nombreHoja = 'Hoja%201'; 

async function procesarAsistencia() {
    var dniVal = document.getElementById('dni').value;
    var pinVal = document.getElementById('pin').value;

    if (!dniVal || !pinVal) {
        alert("Complete DNI y PIN");
        return;
    }

    try {
        var hoy = new Date().toLocaleDateString('es-AR');
        // Agregamos el parámetro de la hoja también en la búsqueda
        var urlBusqueda = urlBase + "/search?DNI=" + dniVal + "&Fecha=" + hoy + "&sheet=" + nombreHoja;
        
        var respuesta = await fetch(urlBusqueda); 
        var datos = await respuesta.json();
        
        if (!Array.isArray(datos)) {
            throw new Error("Respuesta de API inválida");
        }

        var cantidad = datos.length;

        if (cantidad === 0 || cantidad === 3) {
            gestionarEnvio(dniVal, cantidad);
        } else {
            alert("VALIDACIÓN EN GUARDIA REQUERIDA");
            iniciarEscaneo(dniVal, cantidad);
        }
    } catch (error) {
        alert("ERROR EN BÚSQUEDA: " + error.message);
    }
}

function gestionarEnvio(dniU, cuenta) {
    var mov = "";
    if (cuenta === 0) mov = "Ingreso";
    else if (cuenta === 1) mov = "Inicio Pausa";
    else if (cuenta === 2) mov = "Fin Pausa";
    else if (cuenta === 3) mov = "Egreso";

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var ahora = new Date();
        var hoy = ahora.toLocaleDateString('es-AR');
        var horaActual = ahora.toLocaleTimeString('es-AR');
        var coords = pos.coords.latitude.toFixed(4) + ", " + pos.coords.longitude.toFixed(4);
        
        var urlFinal = "";
        var metodo = "";
        var cuerpo = { "data": {} };

        if (cuenta === 0) {
            // POST: Crear fila nueva
            metodo = 'POST';
            urlFinal = urlBase + "?sheet=" + nombreHoja;
            cuerpo.data = [{
                "Fecha": hoy,
                "Nombre": nombreU,
                "DNI": dniU,
                "Ingreso": horaActual,
                "Distancia": coords
            }];
        } else {
            // PATCH: Actualizar fila existente
            metodo = 'PATCH';
            // Filtramos por DNI y Fecha para asegurar que sea la fila de hoy
            urlFinal = urlBase + "/DNI/" + dniU + "?sheet=Hoja%201" + "&Fecha=" + hoy;
            cuerpo.data[mov] = horaActual;
            cuerpo.data["Distancia"] = coords;
        }

        try {
            var res = await fetch(urlFinal, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cuerpo)
            });

            var resultadoTexto = await res.text();

            if (res.ok) {
                alert("REGISTRO EXITOSO: " + mov.toUpperCase());
                location.reload();
            } else {
                // Si la API rechaza el dato, nos dirá por qué (ej: columna no encontrada)
                alert("LA PLANILLA RECHAZÓ EL DATO: " + resultadoTexto);
            }
        } catch (e) {
            alert("ERROR DE RED: No se pudo llegar a la planilla.");
        }
    }, function() { alert("GPS OBLIGATORIO"); });
}
