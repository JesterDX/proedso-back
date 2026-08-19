const axios = require('axios');
const { parse } = require('csv-parse/sync');
const pool = require('../config/db');


// ============================================================
// GOOGLE SHEETS
// ============================================================

const SHEETS_URL =
  'https://docs.google.com/spreadsheets/d/1xd2NGCo5rYryrJrW-BXebbTxPL6DMOWHBCHjjVLXma0/export?format=csv&gid=0';


// ============================================================
// LISTAR HOMOLOGACIONES
// ============================================================

async function listarHomologaciones() {

  const result = await pool.query(`
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
        SELECT COUNT(*)
        FROM homologacion_pagos hp
        WHERE hp.homologacion_id = h.id
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

async function obtenerHomologacion(id) {

  const result = await pool.query(`
    SELECT
      h.*
    FROM homologaciones h
    WHERE h.id = $1
    LIMIT 1
  `, [id]);

  if (!result.rows.length) {
    throw new Error('Homologación no encontrada.');
  }

  return result.rows[0];
}


// ============================================================
// ACTUALIZAR HOMOLOGACIÓN
// ============================================================

async function actualizarHomologacion(id, data) {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const actualResult = await client.query(`
      SELECT *
      FROM homologaciones
      WHERE id = $1
      FOR UPDATE
    `, [id]);

    if (!actualResult.rows.length) {
      throw new Error('Homologación no encontrada.');
    }


    const actual = actualResult.rows[0];


    // ========================================================
    // DATOS BÁSICOS
    // ========================================================

    const alumno =
      data.alumno !== undefined
        ? String(data.alumno).trim()
        : actual.alumno;

    const dni =
      data.dni !== undefined
        ? String(data.dni).trim()
        : actual.dni;

    const celular =
      data.celular !== undefined
        ? String(data.celular).trim()
        : actual.celular;

    const curso =
      data.curso_equipo !== undefined
        ? String(data.curso_equipo).trim()
        : actual.curso_equipo;

    const vendedor =
      data.vendedor !== undefined
        ? String(data.vendedor).trim()
        : actual.vendedor;

    const estado =
      data.estado !== undefined
        ? String(data.estado).trim()
        : actual.estado;

    const estadoDocumento =
      data.estado_documento !== undefined
        ? String(data.estado_documento).trim()
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
        Number(data.monto_total);

    }


    if (
      Number.isNaN(
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
    // IMPORTANTE
    //
    // EL PAGADO NO SE RECIBE DEL FRONTEND.
    //
    // SE CALCULA DESDE homologacion_pagos.
    // ========================================================

    const pagosResult =
      await client.query(`
        SELECT
          COALESCE(
            SUM(monto),
            0
          ) AS total_pagado
        FROM homologacion_pagos
        WHERE homologacion_id = $1
      `, [id]);


    const montoPagado =
      Number(
        pagosResult.rows[0].total_pagado
      );


    const saldo =
      Math.max(
        0,
        Number(montoTotal) -
        montoPagado
      );


    // ========================================================
    // ESTADO DE PAGO AUTOMÁTICO
    // ========================================================

    let estadoPago;

    if (montoPagado <= 0) {

      estadoPago = 'PENDIENTE';

    }
    else if (
      montoPagado < Number(montoTotal)
    ) {

      estadoPago = 'PARCIAL';

    }
    else {

      estadoPago = 'PAGADO';

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

        WHERE id = $15

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


    await client.query('COMMIT');

    return result.rows[0];

  }
  catch (error) {

    await client.query('ROLLBACK');

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

    await client.query('BEGIN');


    // ========================================================
    // HOMOLOGACIÓN
    // ========================================================

    const homologacionResult =
      await client.query(`
        SELECT *
        FROM homologaciones
        WHERE id = $1
        FOR UPDATE
      `, [homologacionId]);


    if (!homologacionResult.rows.length) {

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
      Number(data.monto);


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
        WHERE homologacion_id = $1
      `, [homologacionId]);


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

    if (monto > saldoActual) {

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
    // ACTUALIZAR HOMOLOGACIÓN
    // ========================================================

    const homologacionActualizada =
      await client.query(`
        UPDATE homologaciones
        SET

          monto_pagado = $1,

          saldo_pendiente = $2,

          estado_pago = $3

        WHERE id = $4

        RETURNING *
      `, [

        nuevoPagado,

        nuevoSaldo,

        nuevoEstadoPago,

        homologacionId

      ]);


    await client.query('COMMIT');


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
    `, [homologacionId]);


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

    await client.query('BEGIN');


    const pagoResult =
      await client.query(`
        SELECT *
        FROM homologacion_pagos
        WHERE id = $1
        FOR UPDATE
      `, [pagoId]);


    if (!pagoResult.rows.length) {

      throw new Error(
        'Pago no encontrado.'
      );

    }


    const pago =
      pagoResult.rows[0];


    await client.query(`
      DELETE FROM homologacion_pagos
      WHERE id = $1
    `, [pagoId]);


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
          ON hp.homologacion_id = h.id

        WHERE h.id = $1

        GROUP BY h.id
      `, [pago.homologacion_id]);


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

    if (pagado <= 0) {

      estadoPago =
        'PENDIENTE';

    }
    else if (pagado < total) {

      estadoPago =
        'PARCIAL';

    }
    else {

      estadoPago =
        'PAGADO';

    }


    await client.query(`
      UPDATE homologaciones
      SET

        monto_pagado = $1,

        saldo_pendiente = $2,

        estado_pago = $3

      WHERE id = $4
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
// IMPORTAR DESDE SHEETS
// ============================================================

async function importarDesdeSheets() {

  let creados = 0;
  let actualizados = 0;
  let omitidos = 0;

  const errores = [];
  const omitidosDetalle = [];


  const respuesta =
    await axios.get(
      SHEETS_URL
    );


  const filas =
    parse(
      respuesta.data,
      {
        columns: true,
        skip_empty_lines: true
      }
    );


  for (const row of filas) {

    try {

      const googleId =
        Number(
          row["ID"]
        );


      const dni =
        String(
          row["DNI"] ?? ""
        ).trim();


      const alumno =
        String(
          row["APELLIDOS Y NOMBRES"] ?? ""
        ).trim();


      const curso =
        String(
          row["Curso/ Equipos "] ??
          row["Curso/ Equipos"] ??
          ""
        ).trim();


      if (
        !googleId ||
        !dni ||
        !curso
      ) {

        omitidos++;

        omitidosDetalle.push({

          googleId,

          dni,

          curso,

          motivo:
            "ID, DNI o Curso vacío"

        });

        continue;

      }


      // ======================================================
      // FECHA
      // ======================================================

      let fechaRegistro = null;


      const fechaTexto =
        String(
          row["FECHA "] ??
          row["FECHA"] ??
          ""
        ).trim();


      if (fechaTexto) {

        if (
          fechaTexto.includes("/")
        ) {

          const partes =
            fechaTexto.split("/");


          if (
            partes.length === 3
          ) {

            fechaRegistro =
              `${partes[2]}-${partes[1]}-${partes[0]}`;

          }

        }
        else if (
          !isNaN(
            Number(fechaTexto)
          )
        ) {

          const excelDate =
            Number(fechaTexto);


          const ms =
            (
              excelDate -
              25569
            ) *
            86400 *
            1000;


          const date =
            new Date(ms);


          fechaRegistro =
            `${date.getUTCFullYear()}-${
              String(
                date.getUTCMonth() + 1
              ).padStart(2, "0")
            }-${
              String(
                date.getUTCDate()
              ).padStart(2, "0")
            }`;

        }

      }


      // ======================================================
      // MONTO
      // ======================================================

      const montoIndicado =
        Number(
          String(
            row["MONTO INDICADO"] ?? "0"
          )
            .replace(/\./g, "")
            .replace(",", ".")
        ) || 0;


      // ======================================================
      // BUSCAR
      // ======================================================

      const existe =
        await pool.query(`
          SELECT id
          FROM homologaciones
          WHERE google_id = $1
        `, [googleId]);


      if (
        existe.rows.length > 0
      ) {

        // ====================================================
        // IMPORTANTE
        //
        // NO TOCAMOS:
        //
        // monto_pagado
        // saldo_pendiente
        // estado_pago
        //
        // porque ahora vienen de los pagos reales.
        // ====================================================

        await pool.query(`
          UPDATE homologaciones
          SET

            alumno = $1,

            fecha_registro = $2,

            vendedor = $3,

            celular = $4,

            monto_total = $5,

            monto_indicado = $6,

            estado_documento = $7,

            observaciones = $8,

            observaciones_admin = $9,

            dni = $10,

            curso_equipo = $11

          WHERE google_id = $12
        `, [

          alumno,

          fechaRegistro,

          row["Vendedor"] || "",

          row["CELULAR"] || "",

          montoIndicado,

          montoIndicado,

          row["ESTADO DEL DOCUMENTO"] || "",

          row["OBSERVACIONES"] || "",

          row["OBSERVACIONES ADMIN"] || "",

          dni,

          curso,

          googleId

        ]);


        // ====================================================
        // RECALCULAR SALDO SEGÚN PAGOS
        // ====================================================

        const homologacion =
          await pool.query(`
            SELECT
              id,
              monto_total
            FROM homologaciones
            WHERE google_id = $1
          `, [googleId]);


        const homologacionId =
          homologacion.rows[0].id;


        const pagos =
          await pool.query(`
            SELECT
              COALESCE(
                SUM(monto),
                0
              ) AS pagado
            FROM homologacion_pagos
            WHERE homologacion_id = $1
          `, [homologacionId]);


        const pagado =
          Number(
            pagos.rows[0].pagado
          );


        const total =
          Number(
            montoIndicado
          );


        const saldo =
          Math.max(
            0,
            total - pagado
          );


        let estadoPago;

        if (pagado <= 0) {

          estadoPago = 'PENDIENTE';

        }
        else if (pagado < total) {

          estadoPago = 'PARCIAL';

        }
        else {

          estadoPago = 'PAGADO';

        }


        await pool.query(`
          UPDATE homologaciones
          SET

            monto_pagado = $1,

            saldo_pendiente = $2,

            estado_pago = $3

          WHERE id = $4
        `, [

          pagado,

          saldo,

          estadoPago,

          homologacionId

        ]);


        actualizados++;

      }
      else {

        // ====================================================
        // NUEVO
        // ====================================================

        await pool.query(`
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
            0,
            $4,
            'REGISTRADO',
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $3,
            'PENDIENTE',
            $11,
            NULL,
            $12
          )
        `, [

          googleId,

          alumno,

          montoIndicado,

          fechaRegistro,

          row["OBSERVACIONES"] || "",

          dni,

          row["CELULAR"] || "",

          row["Vendedor"] || "",

          curso,

          montoIndicado,

          row["ESTADO DEL DOCUMENTO"] || "",

          row["OBSERVACIONES ADMIN"] || ""

        ]);


        creados++;

      }

    }
    catch (err) {

      errores.push({

        googleId:
          row["ID"],

        dni:
          row["DNI"],

        mensaje:
          err.message

      });

    }

  }


  return {

    ok: true,

    creados,

    actualizados,

    omitidos,

    omitidosDetalle,

    errores,

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
