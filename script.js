// --- VARIABLES GLOBALES ---
var html5QrCode = null;
var urlBase = 'https://sheetdb.io/api/v1/0r37mye22zrgm';
var nombreHojaRegistro = 'Hoja 1'; // Donde se guarda la asistencia
var nombreHojaPersonal = 'Personal'; // Donde se valida el login

// Función para mostrar que el sistema está trabajando
function setCargando(estado) {
    var btn = document.querySelector('button');
    if (btn) {
        btn.disabled = estado;
        btn.innerText = estado ? "⌛ Procesando..." : "Registrar Asistencia";
    }
}

// --- FUNCIÓN 1: VALIDACIÓN Y LÓGICA DE ASISTENCIA ---
async function procesarAsistencia() {
    var dniInput = document.getElementById('dni').value.trim();
    var pinInput = document.getElementById('pin').value.trim();

    if (!dniInput || !pinInput) {
        alert("Complete DNI y PIN");
        return;
    }

    setCargando(true);

    try {
        // 1. VALIDACIÓN EN PESTAÑA PERSONAL
        // Traemos los datos de la hoja Personal para validar manualmente
        var resPersona = await fetch(urlBase + "?sheet=" + nombreHojaPersonal);
        var listaPersonal = await resPersona.json();

        // Buscamos al usuario comparando DNI (Columna A) y Contraseña (Columna C)
        // Usamos los nombres exactos de tus encabezados en la hoja Personal
        var usuarioValido = listaPersonal.find(u => 
            String(u.DNI).trim() === dniInput && 
            String(u.CONTRASEÑA).trim() === pinInput
        );

        if (!usuarioValido) {
            alert("DNI o Contraseña incorrectos. Verifique en la hoja Personal.");
            setCargando(false);
            return;
        }

        // Si es válido, tomamos el nombre completo de la columna B
        var nombreReal = usuarioValido["NOMBRE COMPLETO"];

        // 2. CHEQUEO DE ESTADO EN HOJA 1
        var hoy = new Date().toLocaleDateString('es-AR');
        var resMov = await fetch(urlBase + "/search?DNI=" + dniInput + "&sheet=" + nombreHojaRegistro);
        var movimientos = await resMov.json();
        
        var registroHoy = movimientos.find(f => f.Fecha === hoy);
        var etapa = 0; 

        if (registroHoy) {
            if (registroHoy["Egreso"]) {
                alert("Jornada de hoy ya finalizada.");
                setCargando(false);
                return;
            } else if (registroHoy["Fin Pausa"]) {
                etapa = 3;
            } else if (registroHoy["Inicio Pausa"]) {
                etapa = 2;
            } else if (registroHoy["Ingreso"]) {
                etapa = 1;
            }
        }

        // 3. ACCIÓN SEGÚN ETAPA
        if (etapa === 0 || etapa === 3) {
            gestionarEnvio(dniInput, etapa, nombreReal);
        } else {
            alert("Validación requerida: Escanee el QR de Guardia");
            iniciarEscaneo(dniInput, etapa, nombreReal);
        }

    } catch (e) {
        console.error(e);
        alert("Error de conexión. Intente nuevamente.");
        setCargando(false);
    }
}

// --- FUNCIÓN 2: ESCANEO DE QR (Mantenemos tu lógica) ---
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
        alert("Error al iniciar cámara.");
        setCargando(false);
    });
}

// --- FUNCIÓN 3: ENVÍO DE DATOS A HOJA 1 ---
function gestionarEnvio(dniU, etapa, nombreU) {
    var columnas = ["Ingreso", "Inicio Pausa", "Fin Pausa", "Egreso"];
    var mov = columnas[etapa];

    navigator.geolocation.getCurrentPosition(async function(pos) {
        var ahora = new Date();
        var fechaHoy = ahora.toLocaleDateString('es-AR');
        var horaActual = ahora.toLocaleTimeString('es-AR');
        var gps = pos.coords.latitude.toFixed(5) + "," + pos.coords.longitude.toFixed(5);

        var urlFinal = "";
        var metodo = "";
        var bodyData = { "data": {} };

        if (etapa === 0) {
            metodo = 'POST';
            urlFinal = urlBase + "?sheet=" + nombreHojaRegistro;
            bodyData.data = [{
                "Fecha": fechaHoy,
                "Nombre": nombreU,
                "DNI": dniU,
                "Ingreso": horaActual,
                "Distancia": gps
            }];
        } else {
            metodo = 'PATCH';
            urlFinal = urlBase + "/DNI/" + dniU + "?Fecha=" + fechaHoy + "&sheet=" + nombreHojaRegistro;
            bodyData.data[mov] = horaActual;
            bodyData.data["Distancia"] = gps;
        }

        try {
            var response = await fetch(urlFinal, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                alert("¡Registro de " + mov + " exitoso!");
                location.reload();
            }
        } catch (err) {
            alert("Error al guardar en la planilla.");
            setCargando(false);
        }
    }, function() {
        alert("Error: El GPS es obligatorio.");
        setCargando(false);
    });
}
