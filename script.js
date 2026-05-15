var html5QrCode = null;
var urlBase = 'https://sheetdb.io/api/v1/0r37mye22zrgm';

// FUNCIÓN PARA TENER SIEMPRE LA MISMA FECHA (DD/MM/YYYY)
function obtenerFechaAR() {
    var d = new Date();
    var dia = String(d.getDate()).padStart(2, '0');
    var mes = String(d.getMonth() + 1).padStart(2, '0');
    var anio = d.getFullYear();
    return dia + "/" + mes + "/" + anio;
}

function actualizarEstado(mensaje, color = "black") {
    var btn = document.querySelector('button');
    if (btn) {
        btn.innerText = mensaje;
        btn.style.color = color;
    }
}

async function procesarAsistencia() {
    var dniInput = document.getElementById('dni').value.trim();
    var pinInput = document.getElementById('pin').value.trim();

    if (!dniInput || !pinInput) {
        alert("Complete DNI y PIN");
        return;
    }

    actualizarEstado("⌛ Validando...", "blue");

    try {
        var hoy = obtenerFechaAR();
        
        // 1. LOGIN
        var resPers = await fetch(urlBase + "?sheet=Personal&v=" + new Date().getTime());
        var listaPersonal = await resPers.json();

        var usuario = listaPersonal.find(u => {
            var valores = Object.values(u); 
            return String(valores[0]).trim() === dniInput && String(valores[2]).trim() === pinInput;
        });

        if (!usuario) {
            alert("DNI o PIN incorrectos.");
            actualizarEstado("Registrar Asistencia");
            return;
        }

        var miNombreReal = String(usuario[Object.keys(usuario)[1]]).trim(); 
        actualizarEstado("✅ Hola " + miNombreReal, "green");

        // 2. BUSCAR MOVIMIENTOS (Búsqueda por DNI)
        var urlBusqueda = urlBase + "/search?DNI=" + dniInput + "&sheet=Hoja 1&v=" + new Date().getTime();
        var resMov = await fetch(urlBusqueda);
        var movimientos = await resMov.json();
        
        // Buscamos el registro de hoy (con nuestra fecha manual)
        var registroHoy = movimientos.reverse().find(f => f.Fecha === hoy);
        var etapa = 0; 

        if (registroHoy) {
            // Verificamos qué columna está vacía (usamos !valor para detectar "" o null)
            if (registroHoy["Egreso"]) {
                alert("Jornada ya finalizada.");
                actualizarEstado("Registrar Asistencia");
                return;
            } else if (registroHoy["Fin Pausa"]) {
                etapa = 3; // El siguiente paso es Egreso
            } else if (registroHoy["Inicio Pausa"]) {
                etapa = 2; // El siguiente paso es Fin Pausa
            } else if (registroHoy["Ingreso"]) {
                etapa = 1; // El siguiente paso es Inicio Pausa
            }
        }

        // 3. ACCIÓN
        if (etapa === 0 || etapa === 3) {
            gestionarEnvio(dniInput, etapa, miNombreReal);
        } else {
            alert("Escanee el QR de Guardia para continuar.");
            iniciarEscaneo(dniInput, etapa, miNombreReal);
        }

    } catch (e) {
        alert("Error de conexión.");
        actualizarEstado("Registrar Asistencia");
    }
}

function iniciarEscaneo(dniU, etapa, nombreU) {
    var zona = document.getElementById('reader');
    zona.style.display = 'block';
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 },
        async function(texto) {
            if (texto.toUpperCase().includes("GUARDIA")) {
                await html5QrCode.stop();
                zona.style.display = 'none';
                gestionarEnvio(dniU, etapa, nombreU);
            }
        }
    ).catch(err => {
        alert("Error cámara");
        actualizarEstado("Registrar Asistencia");
    });
}

function gestionarEnvio(dniU, etapa, nombreU) {
    var movs = ["Ingreso", "Inicio Pausa", "Fin Pausa", "Egreso"];
    var columnaDestino = movs[etapa];

    actualizarEstado("🛰️ GPS...", "blue");

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var ahora = new Date();
        var fechaHoy = obtenerFechaAR();
        var horaActual = ahora.getHours().toString().padStart(2, '0') + ":" + ahora.getMinutes().toString().padStart(2, '0');
        var gps = pos.coords.latitude.toFixed(5) + "," + pos.coords.longitude.toFixed(5);

        var urlFinal = "";
        var metodo = "";
        var bodyData = { "data": {} };

        if (etapa === 0) {
            metodo = 'POST';
            urlFinal = urlBase + "?sheet=Hoja 1";
            bodyData.data = [{
                "Fecha": fechaHoy,
                "Nombre": nombreU, 
                "DNI": dniU,
                "Ingreso": horaActual,
                "Distancia": gps
            }];
        } else {
            metodo = 'PATCH';
            // Filtramos por DNI y por la Fecha manual para que no edite filas viejas
            urlFinal = urlBase + "/DNI/" + dniU + "?Fecha=" + fechaHoy + "&sheet=Hoja 1";
            bodyData.data[columnaDestino] = horaActual;
            bodyData.data["Distancia"] = gps;
        }

        try {
            var response = await fetch(urlFinal, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                alert("Registrado: " + columnaDestino);
                location.reload();
            }
        } catch (err) {
            alert("Error al guardar.");
            actualizarEstado("Registrar Asistencia");
        }
    }, () => alert("Active el GPS"), { enableHighAccuracy: true });
}
