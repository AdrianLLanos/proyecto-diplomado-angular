-- Retira roles y permisos de los módulos que ya no forman parte del sistema.
-- Las tablas se conservan para no destruir datos existentes ni romper registros históricos.
DELETE FROM roles WHERE nombre IN ('Accountant','Laboratorist');

DELETE FROM permisos
WHERE nombre ~ '^(departamentos|informes|plantillas-laboratorio|seguros|facturas|pagos|cuentas|monedas|impuestos|reportes)\.';
