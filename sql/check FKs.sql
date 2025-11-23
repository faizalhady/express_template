SELECT
    fk.name AS FK_Name,
    sch.name AS SchemaName,
    tp.name AS TableName,
    cp.name AS ColumnName,
    tr.name AS ReferencedTable,
    cr.name AS ReferencedColumn
FROM
    sys.foreign_keys AS fk
    INNER JOIN sys.foreign_key_columns AS fkc ON fk.object_id = fkc.constraint_object_id
    INNER JOIN sys.tables AS tp ON fkc.parent_object_id = tp.object_id
    INNER JOIN sys.schemas AS sch ON tp.schema_id = sch.schema_id
    INNER JOIN sys.columns AS cp ON fkc.parent_object_id = cp.object_id
    AND fkc.parent_column_id = cp.column_id
    INNER JOIN sys.tables AS tr ON fkc.referenced_object_id = tr.object_id
    INNER JOIN sys.columns AS cr ON fkc.referenced_object_id = cr.object_id
    AND fkc.referenced_column_id = cr.column_id
WHERE
    sch.name = 'core'
ORDER BY
    tp.name,
    fk.name;