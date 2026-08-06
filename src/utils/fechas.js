function convertirFecha(fecha) {

    if (!fecha) return null;

    const texto = String(fecha).trim();

    // Fecha Excel (ej: 46030)
    if (/^\d+$/.test(texto)) {

        const excelEpoch = new Date(1899, 11, 30);

        excelEpoch.setDate(
            excelEpoch.getDate() + Number(texto)
        );

        return excelEpoch;
    }


    // Fecha dd/mm/yyyy
    const partes = texto.split("/");

    if (partes.length === 3) {

        return new Date(
            Number(partes[2]),
            Number(partes[1]) - 1,
            Number(partes[0])
        );

    }


    return null;
}


module.exports = {
    convertirFecha
};
