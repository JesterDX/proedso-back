
const axios = require('axios');
const { parse } = require('csv-parse/sync');
const pool = require('../config/db');


// ============================================================
// GOOGLE SHEETS
// ============================================================

const SHEETS_URL =
  'https://docs.google.com/spreadsheets/d/1xd2NGCo5rYryrJrW-BXebbTxPL6DMOWHBCHjjVLXma0/export?format=csv&gid=0';


// ============================================================
// UTILIDADES
// ============================================================

/**
 * Convierte valores provenientes de Google Sheets
 * a número de forma segura.
 *
 * Soporta:
 *
 * 199
 * "199"
 * "199.00"
 * "199,00"
 * "S/ 199.00"
 * "S/ 199,00"
 */
function convertirNumero(valor) {

  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {

    return 0;

  }


  let texto =
    String(valor)
      .trim();


  if (!texto) {

    return 0;

  }


  // Eliminar moneda y espacios
  texto =
    texto
      .replace(/S\/?/gi, '')
      .replace(/\s/g, '');


  /*
   * Si tiene punto y coma decimal:
   *
   * 1.234,56
   *
   * se convierte a:
   *
   * 1234.56
   */

  if (
    texto.includes('.') &&
    texto.includes(',')
  ) {

    texto =
      texto
        .replace(/\./g, '')
        .replace(',', '.');

  }

  /*
   * Si solamente tiene coma:
   *
   * 199,00
   *
   * -> 199.00
   */

  else if (
    texto.includes(',')
  ) {

    texto =
      texto.replace(',', '.');

  }


  const numero =
    Number(texto);


  return Number.isFinite(numero)
    ? numero
    : 0;

}


/**
 * Normaliza texto.
 */
function textoSeguro(valor) {

  if (
    valor === undefined ||
    valor === null
  ) {

    return '';

  }


  return String(valor).trim();

}


/**
 * Convierte una fecha de Google Sheets / Excel
 * a formato YYYY-MM-DD.
 */
function convertirFecha(valor) {

  const texto =
    textoSeguro(valor);


  if (!texto) {

    return null;

  }


  // ==========================================================
  // FORMATO DD/MM/YYYY
  // ==========================================================

  if (
    texto.includes('/')
  ) {

    const partes =
      texto.split('/');


    if (
      partes.length === 3
    ) {

      let dia =
        partes[0].trim();

      let mes =
        partes[1].trim();

      let anio =
        partes[2].trim();


      /*
       * En caso de año de dos dígitos.
       */
      if (
        anio.length === 2
      ) {

        anio =
          `20${anio}`;

      }


      dia =
        dia.padStart(2, '0');

      mes =
        mes.padStart(2, '0');


      return `${anio}-${mes}-${dia}`;

    }

  }


  // ==========================================================
  // FECHA SERIAL DE EXCEL
  // ==========================================================

  if (
    !isNaN(
      Number(texto)
    )
  ) {

    const excelDate =
      Number(texto);


    /*
     * Evitamos interpretar números pequeños
     * como fechas por accidente.
     */
    if (
      excelDate > 1000
    ) {

      const ms =
        (
          excelDate -
          25569
        ) *
        86400 *
        1000;


      const date =
        new Date(ms);


      if (
        !isNaN(
          date.getTime()
        )
      ) {

        return `${date.getUTCFullYear()}-${
          String(
            date.getUTCMonth() + 1
          ).padStart(2, '0')
        }-${
          String(
            date.getUTCDate()
          ).padStart(2, '0')
        }`;

      }

    }

  }


  // ==========================================================
  // YYYY-MM-DD
  // ==========================================================

  if (
    /^\d{4}-\d{2}-\d{2}/.test(texto)
  ) {

    return texto.substring(
      0,
      10
    );

  }


  return null;

}


// ============================================================
// LISTAR HOMOLOGACIONES
// ============================================================

async function listarHomologaciones() {

  const result =
    await pool.query(`
      SELECT

        h.id,

        h.google_id,

        h.fecha_registro,

        h.alumno,

        h.alumno_id,

        h.tipo_homologacion,

        h.curso_equipo,

        h.dni,

        h.celular,

        h.vendedor,

        h.monto_total,

        h.monto_pagado,

        h.monto_indicado,

        h.saldo_pendiente,

        h.estado_pago,

        h.estado_documento,

        h.fecha_envio,

        h.estado,

        h.observaciones,

        h.observaciones_admin,

        (
          SELECT
            COUNT(*)
          FROM homologacion_pagos hp
          WHERE
            hp.homologacion_id = h.id
        ) AS cantidad_pagos,

        EXISTS (
          SELECT 1
          FROM homologacion_pagos hp
          WHERE
            hp.homologacion_id = h.id
            AND hp.boleta_generada = TRUE
        ) AS tiene_boleta

      FROM homologaciones h

      ORDER BY
        h.fecha_registro DESC,
        h.id DESC
    `);


  return result.rows;

}


// ============================================================
// OBTENER HOMOLOGACIÓN
// ============================================================

async function obtenerHomologacion(
  id
) {

  const result =
    await pool.query(`
      SELECT
        h.*
      FROM homologaciones h
      WHERE
        h.id = $1
      LIMIT 1
    `, [
      id
    ]);


  if (
    !result.rows.length
  ) {

    throw new Error(
      'Homologación no encontrada.'
    );

  }


  return result.rows[0];

}


// ============================================================
// ACTUALIZAR HOMOLOGACIÓN
// ============================================================

async function actualizarHomologacion(
  id,
  data
) {

  const client =
    await pool.connect();


  try {

    await client.query(
      'BEGIN'
    );


    // ========================================================
    // OBTENER ACTUAL
    // ========================================================

    const actualResult =
      await client.query(`
        SELECT *
        FROM homologaciones
        WHERE id = $1
        FOR UPDATE
      `, [
        id
      ]);


    if (
      !actualResult.rows.length
    ) {

      throw new Error(
        'Homologación no encontrada.'
      );

    }


    const actual =
      actualResult.rows[0];


    // ========================================================
    // DATOS BÁSICOS
    // ========================================================

    const alumno =
      data.alumno !== undefined
        ? textoSeguro(data.alumno)
        : actual.alumno;


    const dni =
      data.dni !== undefined
        ? textoSeguro(data.dni)
        : actual.dni;


    const celular =
      data.celular !== undefined
        ? textoSeguro(data.celular)
        : actual.celular;


    const curso =
      data.curso_equipo !== undefined
        ? textoSeguro(data.curso_equipo)
        : actual.curso_equipo;


    const vendedor =
      data.vendedor !== undefined
        ? textoSeguro(data.vendedor)
        : actual.vendedor;


    const estado =
      data.estado !== undefined
        ? textoSeguro(data.estado)
        : actual.estado;


    const estadoDocumento =
      data.estado_documento !== undefined
        ? textoSeguro(data.estado_documento)
        : actual.estado_documento;


    const observaciones =
      data.observaciones !== undefined
        ? data.observaciones
        : actual.observaciones;


    const observacionesAdmin =
      data.observaciones_admin !== undefined
        ? data.observaciones_admin
        : actual.observaciones_admin;


    // ========================================================
    // FECHA
    // ========================================================

    let fechaRegistro =
      actual.fecha_registro;


    if (
      data.fecha_registro !== undefined &&
      data.fecha_registro !== null &&
      data.fecha_registro !== ''
    ) {

      fechaRegistro =
        data.fecha_registro;

    }


    // ========================================================
    // MONTO TOTAL
    // ========================================================

    let montoTotal =
      actual.monto_total;


    if (
      data.monto_total !== undefined &&
      data.monto_total !== null &&
      data.monto_total !== ''
    ) {

      montoTotal =
        convertirNumero(
          data.monto_total
        );

    }


    if (
      !Number.isFinite(
        Number(montoTotal)
      )
    ) {

      throw new Error(
        'El monto total no es válido.'
      );

    }


    if (
      Number(montoTotal) < 0
    ) {

      throw new Error(
        'El monto total no puede ser negativo.'
      );

    }


    // ========================================================
    // PAGOS REALES
    //
    // El monto pagado siempre se obtiene
    // de homologacion_pagos.
    // ========================================================

    const pagosResult =
      await client.query(`
        SELECT
          COALESCE(
            SUM(monto),
            0
          ) AS total_pagado

        FROM homologacion_pagos

        WHERE
          homologacion_id = $1
      `, [
        id
      ]);


    const montoPagado =
      Number(
        pagosResult.rows[0].total_pagado
      );


    // ========================================================
    // SALDO
    // ========================================================

    const saldo =
      Math.max(
        0,
        Number(montoTotal) -
        montoPagado
      );


    // ========================================================
    // ESTADO DE PAGO
    // ========================================================

    let estadoPago;


    if (
      montoPagado <= 0
    ) {

      estadoPago =
        'PENDIENTE';

    }

    else if (
      montoPagado <
      Number(montoTotal)
    ) {

      estadoPago =
        'PARCIAL';

    }

    else {

      estadoPago =
        'PAGADO';

    }


    // ========================================================
    // UPDATE
    // ========================================================

    const result =
      await client.query(`
        UPDATE homologaciones
        SET

          alumno = $1,

          dni = $2,

          celular = $3,

          curso_equipo = $4,

          vendedor = $5,

          monto_total = $6,

          monto_pagado = $7,

          saldo_pendiente = $8,

          estado_pago = $9,

          estado_documento = $10,

          estado = $11,

          fecha_registro = $12,

          observaciones = $13,

          observaciones_admin = $14

        WHERE
          id = $15

        RETURNING *
      `, [

        alumno,

        dni,

        celular,

        curso,

        vendedor,

        montoTotal,

        montoPagado,

        saldo,

        estadoPago,

        estadoDocumento,

        estado,

        fechaRegistro,

        observaciones,

        observacionesAdmin,

        id

      ]);


    await client.query(
      'COMMIT'
    );


    return result.rows[0];

  }

  catch (error) {

    await client.query(
      'ROLLBACK'
    );

    throw error;

  }

  finally {

    client.release();

  }

}


// ============================================================
// REGISTRAR PAGO
// ============================================================

async function registrarPago(
  homologacionId,
  data
) {

  const client =
    await pool.connect();


  try {

    await client.query(
      'BEGIN'
    );


    // ========================================================
    // HOMOLOGACIÓN
    // ========================================================

    const homologacionResult =
      await client.query(`
        SELECT *
        FROM homologaciones
        WHERE id = $1
        FOR UPDATE
      `, [
        homologacionId
      ]);


    if (
      !homologacionResult.rows.length
    ) {

      throw new Error(
        'Homologación no encontrada.'
      );

    }


    const homologacion =
      homologacionResult.rows[0];


    // ========================================================
    // MONTO
    // ========================================================

    const monto =
      convertirNumero(
        data.monto
      );


    if (
      !Number.isFinite(monto) ||
      monto <= 0
    ) {

      throw new Error(
        'El monto del pago debe ser mayor a 0.'
      );

    }


    // ========================================================
    // PAGADO ACTUAL
    // ========================================================

    const pagosActuales =
      await client.query(`
        SELECT
          COALESCE(
            SUM(monto),
            0
          ) AS total_pagado

        FROM homologacion_pagos

        WHERE
          homologacion_id = $1
      `, [
        homologacionId
      ]);


    const pagadoActual =
      Number(
        pagosActuales.rows[0].total_pagado
      );


    const total =
      Number(
        homologacion.monto_total || 0
      );


    const saldoActual =
      Math.max(
        0,
        total - pagadoActual
      );


    // ========================================================
    // VALIDAR EXCESO
    // ========================================================

    if (
      monto > saldoActual
    ) {

      throw new Error(
        `El pago supera el saldo pendiente de S/ ${saldoActual.toFixed(2)}.`
      );

    }


    // ========================================================
    // BOLETA
    // ========================================================

    const boletaGenerada =
      Boolean(
        data.boleta_generada
      );


    // ========================================================
    // INSERTAR PAGO
    // ========================================================

    const pagoResult =
      await client.query(`
        INSERT INTO homologacion_pagos (

          homologacion_id,

          monto,

          fecha_pago,

          metodo_pago,

          numero_operacion,

          observaciones,

          boleta_generada,

          boleta_serie,

          boleta_numero,

          boleta_fecha,

          boleta_pdf_url

        )

        VALUES (

          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11

        )

        RETURNING *
      `, [

        homologacionId,

        monto,

        data.fecha_pago ||
          new Date()
            .toISOString()
            .substring(0, 10),

        data.metodo_pago ||
          null,

        data.numero_operacion ||
          null,

        data.observaciones ||
          null,

        boletaGenerada,

        data.boleta_serie ||
          null,

        data.boleta_numero ||
          null,

        data.boleta_fecha ||
          null,

        data.boleta_pdf_url ||
          null

      ]);


    // ========================================================
    // NUEVOS TOTALES
    // ========================================================

    const nuevoPagado =
      pagadoActual +
      monto;


    const nuevoSaldo =
      Math.max(
        0,
        total - nuevoPagado
      );


    let nuevoEstadoPago;


    if (
      nuevoPagado <= 0
    ) {

      nuevoEstadoPago =
        'PENDIENTE';

    }

    else if (
      nuevoPagado < total
    ) {

      nuevoEstadoPago =
        'PARCIAL';

    }

    else {

      nuevoEstadoPago =
        'PAGADO';

    }


    // ========================================================
    // ACTUALIZAR TOTALES
    // ========================================================

    const homologacionActualizada =
      await client.query(`
        UPDATE homologaciones
        SET

          monto_pagado = $1,

          saldo_pendiente = $2,

          estado_pago = $3

        WHERE
          id = $4

        RETURNING *
      `, [

        nuevoPagado,

        nuevoSaldo,

        nuevoEstadoPago,

        homologacionId

      ]);


    await client.query(
      'COMMIT'
    );


    return {

      pago:
        pagoResult.rows[0],

      homologacion:
        homologacionActualizada.rows[0]

    };

  }

  catch (error) {

    await client.query(
      'ROLLBACK'
    );

    throw error;

  }

  finally {

    client.release();

  }

}


// ============================================================
// LISTAR PAGOS
// ============================================================

async function listarPagos(
  homologacionId
) {

  const result =
    await pool.query(`
      SELECT
        hp.*

      FROM homologacion_pagos hp

      WHERE
        hp.homologacion_id = $1

      ORDER BY
        hp.fecha_pago DESC,
        hp.id DESC
    `, [
      homologacionId
    ]);


  return result.rows;

}


// ============================================================
// ELIMINAR PAGO
// ============================================================

async function eliminarPago(
  pagoId
) {

  const client =
    await pool.connect();


  try {

    await client.query(
      'BEGIN'
    );


    // ========================================================
    // OBTENER PAGO
    // ========================================================

    const pagoResult =
      await client.query(`
        SELECT *
        FROM homologacion_pagos
        WHERE id = $1
        FOR UPDATE
      `, [
        pagoId
      ]);


    if (
      !pagoResult.rows.length
    ) {

      throw new Error(
        'Pago no encontrado.'
      );

    }


    const pago =
      pagoResult.rows[0];


    // ========================================================
    // ELIMINAR
    // ========================================================

    await client.query(`
      DELETE FROM homologacion_pagos
      WHERE id = $1
    `, [
      pagoId
    ]);


    // ========================================================
    // RECALCULAR
    // ========================================================

    const totales =
      await client.query(`
        SELECT

          h.monto_total,

          COALESCE(
            SUM(hp.monto),
            0
          ) AS monto_pagado

        FROM homologaciones h

        LEFT JOIN homologacion_pagos hp
          ON hp.homologacion_id =
             h.id

        WHERE
          h.id = $1

        GROUP BY
          h.id
      `, [
        pago.homologacion_id
      ]);


    const total =
      Number(
        totales.rows[0].monto_total
      );


    const pagado =
      Number(
        totales.rows[0].monto_pagado
      );


    const saldo =
      Math.max(
        0,
        total - pagado
      );


    let estadoPago;


    if (
      pagado <= 0
    ) {

      estadoPago =
        'PENDIENTE';

    }

    else if (
      pagado < total
    ) {

      estadoPago =
        'PARCIAL';

    }

    else {

      estadoPago =
        'PAGADO';

    }


    // ========================================================
    // ACTUALIZAR HOMOLOGACIÓN
    // ========================================================

    await client.query(`
      UPDATE homologaciones
      SET

        monto_pagado = $1,

        saldo_pendiente = $2,

        estado_pago = $3

      WHERE
        id = $4
    `, [

      pagado,

      saldo,

      estadoPago,

      pago.homologacion_id

    ]);


    await client.query(
      'COMMIT'
    );


    return {
      ok: true
    };

  }

  catch (error) {

    await client.query(
      'ROLLBACK'
    );

    throw error;

  }

  finally {

    client.release();

  }

}


// ============================================================
// IMPORTAR DESDE GOOGLE SHEETS
//
// REGLA:
//
// 1. Si google_id NO existe:
//      INSERTAR.
//
// 2. Si google_id YA existe:
//      NO MODIFICAR ABSOLUTAMENTE NADA.
//
// Esto evita perder datos que hayan sido llenados
// posteriormente desde el sistema.
//
// Además:
//
// MONTO INDICADO
//      -> monto_total
//
// MONTO CANCELADO
//      -> pago inicial en homologacion_pagos
//
// SALDO PENDIENTE
//      -> se calcula desde los pagos.
//
// ESTADO DE PAGO
//      -> se calcula desde los pagos.
// ============================================================

async function importarDesdeSheets() {

  let creados = 0;

  let omitidos = 0;

  let pagosIniciales = 0;

  const errores = [];

  const omitidosDetalle = [];


  // ==========================================================
  // DESCARGAR SHEETS
  // ==========================================================

  const respuesta =
    await axios.get(
      SHEETS_URL
    );


  // ==========================================================
  // PARSEAR CSV
  // ==========================================================

  const filas =
    parse(
      respuesta.data,
      {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: true
      }
    );


  console.log(
    `Google Sheets: ${filas.length} filas encontradas.`
  );


  // ==========================================================
  // RECORRER FILAS
  // ==========================================================

  for (
    const row of filas
  ) {

    const client =
      await pool.connect();


    try {

      await client.query(
        'BEGIN'
      );


      // ======================================================
      // ID DE GOOGLE SHEETS
      // ======================================================

      const googleId =
        Number(
          row["ID"]
        );


      // ======================================================
      // DATOS BÁSICOS
      // ======================================================

      const dni =
        textoSeguro(
          row["DNI"]
        );


      const alumno =
        textoSeguro(
          row["APELLIDOS Y NOMBRES"]
        );


      const curso =
        textoSeguro(
          row["Curso/ Equipos"] ??
          row["Curso/ Equipos "] ??
          ""
        );


      // ======================================================
      // VALIDACIÓN MÍNIMA
      // ======================================================

      if (
        !Number.isFinite(googleId) ||
        googleId <= 0 ||
        !dni ||
        !curso
      ) {

        omitidos++;


        omitidosDetalle.push({

          googleId,

          dni,

          curso,

          motivo:
            'ID, DNI o Curso vacío o inválido.'

        });


        await client.query(
          'ROLLBACK'
        );


        continue;

      }


      // ======================================================
      // VERIFICAR SI YA EXISTE
      //
      // MUY IMPORTANTE:
      //
      // Se bloquea el registro si existe.
      // ======================================================

      const existe =
        await client.query(`
          SELECT
            id
          FROM homologaciones
          WHERE
            google_id = $1
          FOR UPDATE
        `, [
          googleId
        ]);


      // ======================================================
      // SI EXISTE
      //
      // NO SE TOCA.
      // ======================================================

      if (
        existe.rows.length > 0
      ) {

        omitidos++;


        omitidosDetalle.push({

          googleId,

          dni,

          curso,

          homologacionId:
            existe.rows[0].id,

          motivo:
            'El registro ya existe. No se modificó ningún dato.'

        });


        await client.query(
          'COMMIT'
        );


        continue;

      }


      // ======================================================
      // FECHA
      // ======================================================

      const fechaRegistro =
        convertirFecha(
          row["FECHA "] ??
          row["FECHA"]
        );


      // ======================================================
      // MONTO INDICADO
      //
      // Este será el monto total.
      // ======================================================

      const montoIndicado =
        convertirNumero(
          row["MONTO INDICADO"]
        );


      // ======================================================
      // MONTO CANCELADO
      //
      // Este será el pago inicial.
      // ======================================================

      let montoCancelado =
        convertirNumero(
          row["MONTO CANCELADO"]
        );


      // ======================================================
      // VALIDAR MONTOS
      // ======================================================

      if (
        montoIndicado < 0
      ) {

        throw new Error(
          'MONTO INDICADO no puede ser negativo.'
        );

      }


      if (
        montoCancelado < 0
      ) {

        montoCancelado = 0;

      }


      /*
       * Nunca permitimos que el pago inicial
       * sea superior al monto total.
       */

      if (
        montoCancelado >
        montoIndicado
      ) {

        console.warn(
          `Google ID ${googleId}: ` +
          `MONTO CANCELADO (${montoCancelado}) ` +
          `supera MONTO INDICADO (${montoIndicado}). ` +
          `Se ajustará al total.`
        );


        montoCancelado =
          montoIndicado;

      }


      // ======================================================
      // DATOS RESTANTES
      // ======================================================

      const celular =
        textoSeguro(
          row["CELULAR"]
        );


      const vendedor =
        textoSeguro(
          row["Vendedor"]
        );


      const observaciones =
        textoSeguro(
          row["OBSERVACIONES"]
        );


      const estadoDocumento =
        textoSeguro(
          row["ESTADO DEL DOCUMENTO"]
        );


      const observacionesAdmin =
        textoSeguro(
          row["OBSERVACIONES ADMIN"]
        );


      // ======================================================
      // CALCULAR TOTALES INICIALES
      // ======================================================

      const montoPagadoInicial =
        montoCancelado;


      const saldoInicial =
        Math.max(
          0,
          montoIndicado -
          montoPagadoInicial
        );


      let estadoPagoInicial;


      if (
        montoPagadoInicial <= 0
      ) {

        estadoPagoInicial =
          'PENDIENTE';

      }

      else if (
        montoPagadoInicial <
        montoIndicado
      ) {

        estadoPagoInicial =
          'PARCIAL';

      }

      else {

        estadoPagoInicial =
          'PAGADO';

      }


      // ======================================================
      // INSERTAR HOMOLOGACIÓN
      // ======================================================

      const homologacionResult =
        await client.query(`
          INSERT INTO homologaciones (

            google_id,

            alumno,

            alumno_id,

            tipo_homologacion,

            monto_total,

            monto_pagado,

            fecha_registro,

            estado,

            observaciones,

            dni,

            celular,

            vendedor,

            curso_equipo,

            monto_indicado,

            saldo_pendiente,

            estado_pago,

            estado_documento,

            fecha_envio,

            observaciones_admin

          )

          VALUES (

            $1,

            $2,

            NULL,

            'INDIVIDUAL',

            $3,

            $4,

            $5,

            'REGISTRADO',

            $6,

            $7,

            $8,

            $9,

            $10,

            $11,

            $12,

            $13,

            $14,

            NULL,

            $15

          )

          RETURNING id
        `, [

          googleId,

          alumno,

          montoIndicado,

          montoPagadoInicial,
          fechaRegistro,

          observaciones,

          dni,

          celular,

          vendedor,

          curso,

          montoIndicado,

          saldoInicial,

          estadoPagoInicial,

          estadoDocumento,

          observacionesAdmin

        ]);


      const homologacionId =
        homologacionResult.rows[0].id;


      // ======================================================
      // REGISTRAR PAGO INICIAL
      //
      // SOLO SI SHEETS TIENE MONTO CANCELADO > 0.
      //
      // Este registro permite que posteriormente:
      //
      // SUM(homologacion_pagos.monto)
      //
      // siga siendo la fuente real del monto pagado.
      // ======================================================

      if (
        montoCancelado > 0
      ) {

        await client.query(`
          INSERT INTO homologacion_pagos (

            homologacion_id,

            monto,

            fecha_pago,

            metodo_pago,

            numero_operacion,

            observaciones,

            boleta_generada,

            boleta_serie,

            boleta_numero,

            boleta_fecha,

            boleta_pdf_url

          )

          VALUES (

            $1,

            $2,

            $3,

            NULL,

            NULL,

            $4,

            FALSE,

            NULL,

            NULL,

            NULL,

            NULL

          )
        `, [

          homologacionId,

          montoCancelado,

          fechaRegistro ||
            new Date()
              .toISOString()
              .substring(0, 10),

          'Pago inicial importado desde Google Sheets.'

        ]);


        pagosIniciales++;

      }


      // ======================================================
      // CONFIRMAR TRANSACCIÓN
      // ======================================================

      await client.query(
        'COMMIT'
      );


      creados++;


      console.log(
        `Homologación creada: ` +
        `Google ID ${googleId} | ` +
        `${alumno} | ` +
        `Total S/ ${montoIndicado.toFixed(2)} | ` +
        `Cancelado S/ ${montoCancelado.toFixed(2)} | ` +
        `Saldo S/ ${saldoInicial.toFixed(2)}`
      );

    }

    catch (err) {

      try {

        await client.query(
          'ROLLBACK'
        );

      }
      catch (
        rollbackError
      ) {

        console.error(
          'Error haciendo rollback:',
          rollbackError
        );

      }


      errores.push({

        googleId:
          row["ID"],

        dni:
          row["DNI"],

        alumno:
          row["APELLIDOS Y NOMBRES"],

        mensaje:
          err.message

      });


      console.error(
        `Error importando Google ID ${row["ID"]}:`,
        err.message
      );

    }

    finally {

      client.release();

    }

  }


  // ==========================================================
  // RESULTADO
  // ==========================================================

  return {

    ok: true,

    creados,

    omitidos,

    pagosIniciales,

    errores,

    omitidosDetalle,

    totalFilas:
      filas.length

  };

}


// ============================================================
// EXPORTAR
// ============================================================

module.exports = {

  listarHomologaciones,

  obtenerHomologacion,

  actualizarHomologacion,

  registrarPago,

  listarPagos,

  eliminarPago,

  importarDesdeSheets

};

