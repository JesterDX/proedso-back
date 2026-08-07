function convertirFecha(fecha) {

    if (!fecha) return null;

    const texto = String(fecha).trim();

    // Fecha Excel (46030)
    if (/^\d+$/.test(texto)) {

        const excelEpoch = new Date(Date.UTC(1899, 11, 30));

        excelEpoch.setUTCDate(
            excelEpoch.getUTCDate() + Number(texto)
        );

        return excelEpoch;
    }

    // Fecha dd/mm/yyyy
    const partes = texto.split("/");

    if (partes.length === 3) {

        return new Date(
            Number(partes[2]),
            Number(partes[1]) - 1,
            Number(partes[0]),
            12, // mediodía para evitar problemas de zona horaria
            0,
            0
        );

    }

    return null;

}

function convertirFechaSQL(fecha){

    const d = convertirFecha(fecha);

    if(!d) return null;

    const anio = d.getFullYear();
    const mes = String(d.getMonth()+1).padStart(2,"0");
    const dia = String(d.getDate()).padStart(2,"0");

    return `${anio}-${mes}-${dia}`;

}

module.exports = {
    convertirFecha,
    convertirFechaSQL
};
