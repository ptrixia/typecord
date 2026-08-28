BEGIN;

LOCK TABLE
    "User",
    "Bot",
    "GatewaySession",
    "Guild",
    "Role",
    "Member",
    "Category",
    "Channel",
    "Message",
    "Attachment",
    "Embed",
    "Reaction",
    "Emoji",
    "Invite",
    "DirectConversation",
    "DirectConversationParticipant",
    "DirectMessage"
IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE "_snowflake_tables" (
    "schemaName" text NOT NULL,
    "tableName"  text NOT NULL,
    PRIMARY KEY ("schemaName", "tableName")
) ON COMMIT DROP;

INSERT INTO "_snowflake_tables" (
    "schemaName",
    "tableName"
)
SELECT
    table_schema,
    table_name
FROM information_schema.columns
WHERE
    table_schema = 'public'
    AND column_name = 'id'
    AND column_default ILIKE '%typecord_snowflake_id%';


CREATE TEMP TABLE "_snowflake_map" (
    "schemaName" text NOT NULL,
    "tableName"  text NOT NULL,
    "oldId"      text NOT NULL,
    "newId"      text NOT NULL,

    PRIMARY KEY (
        "schemaName",
        "tableName",
        "oldId"
    ),

    UNIQUE ("newId")
) ON COMMIT DROP;


DO $$
DECLARE
    target record;
BEGIN
    FOR target IN
        SELECT
            "schemaName",
            "tableName"
        FROM "_snowflake_tables"
    LOOP
        EXECUTE format(
            '
            INSERT INTO "_snowflake_map" (
                "schemaName",
                "tableName",
                "oldId",
                "newId"
            )
            SELECT
                %L,
                %L,
                "id"::text,
                "typecord_snowflake_id"()
            FROM %I.%I
            WHERE "id"::text ~*
                %L
            ',
            target."schemaName",
            target."tableName",
            target."schemaName",
            target."tableName",
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        );
    END LOOP;
END;
$$;


CREATE TEMP TABLE "_snowflake_fk_backup" AS
SELECT
    ns_child.nspname AS "childSchema",
    child.relname AS "childTable",
    constraint_data.conname AS "constraintName",

    pg_get_constraintdef(
        constraint_data.oid,
        true
    ) AS "definition"
FROM pg_constraint constraint_data

JOIN pg_class child
    ON child.oid = constraint_data.conrelid

JOIN pg_namespace ns_child
    ON ns_child.oid = child.relnamespace

JOIN pg_class parent
    ON parent.oid = constraint_data.confrelid

JOIN pg_namespace ns_parent
    ON ns_parent.oid = parent.relnamespace

WHERE
    constraint_data.contype = 'f'

    AND EXISTS (
        SELECT 1
        FROM "_snowflake_tables" snowflake_table
        WHERE
            snowflake_table."schemaName" =
                ns_parent.nspname

            AND snowflake_table."tableName" =
                parent.relname
    );


CREATE TEMP TABLE "_snowflake_fk_columns" AS
SELECT
    ns_child.nspname AS "childSchema",
    child.relname AS "childTable",
    child_column.attname AS "childColumn",

    ns_parent.nspname AS "parentSchema",
    parent.relname AS "parentTable",
    parent_column.attname AS "parentColumn",

    constraint_data.conname AS "constraintName"

FROM pg_constraint constraint_data

JOIN pg_class child
    ON child.oid = constraint_data.conrelid

JOIN pg_namespace ns_child
    ON ns_child.oid = child.relnamespace

JOIN pg_class parent
    ON parent.oid = constraint_data.confrelid

JOIN pg_namespace ns_parent
    ON ns_parent.oid = parent.relnamespace

JOIN LATERAL generate_subscripts(
    constraint_data.conkey,
    1
) AS position(i)
    ON true

JOIN pg_attribute child_column
    ON child_column.attrelid =
        constraint_data.conrelid

    AND child_column.attnum =
        constraint_data.conkey[position.i]

JOIN pg_attribute parent_column
    ON parent_column.attrelid =
        constraint_data.confrelid

    AND parent_column.attnum =
        constraint_data.confkey[position.i]

WHERE
    constraint_data.contype = 'f'

    AND EXISTS (
        SELECT 1
        FROM "_snowflake_tables" snowflake_table
        WHERE
            snowflake_table."schemaName" =
                ns_parent.nspname

            AND snowflake_table."tableName" =
                parent.relname
    );


DO $$
DECLARE
    foreign_key record;
BEGIN
    FOR foreign_key IN
        SELECT *
        FROM "_snowflake_fk_backup"
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I DROP CONSTRAINT %I',
            foreign_key."childSchema",
            foreign_key."childTable",
            foreign_key."constraintName"
        );
    END LOOP;
END;
$$;


DO $$
DECLARE
    relation record;
BEGIN
    FOR relation IN
        SELECT DISTINCT
            "childSchema",
            "childTable",
            "childColumn",
            "parentSchema",
            "parentTable"
        FROM "_snowflake_fk_columns"
    LOOP
        EXECUTE format(
            '
            UPDATE %I.%I AS child
            SET %I = mapping."newId"
            FROM "_snowflake_map" AS mapping
            WHERE
                mapping."schemaName" = %L
                AND mapping."tableName" = %L
                AND child.%I::text = mapping."oldId"
            ',
            relation."childSchema",
            relation."childTable",
            relation."childColumn",

            relation."parentSchema",
            relation."parentTable",

            relation."childColumn"
        );
    END LOOP;
END;
$$;


DO $$
DECLARE
    target record;
BEGIN
    FOR target IN
        SELECT
            "schemaName",
            "tableName"
        FROM "_snowflake_tables"
    LOOP
        EXECUTE format(
            '
            UPDATE %I.%I AS target
            SET "id" = mapping."newId"
            FROM "_snowflake_map" AS mapping
            WHERE
                mapping."schemaName" = %L
                AND mapping."tableName" = %L
                AND target."id"::text = mapping."oldId"
            ',
            target."schemaName",
            target."tableName",

            target."schemaName",
            target."tableName"
        );
    END LOOP;
END;
$$;


DO $$
DECLARE
    foreign_key record;
BEGIN
    FOR foreign_key IN
        SELECT *
        FROM "_snowflake_fk_backup"
    LOOP
        EXECUTE format(
            '
            ALTER TABLE %I.%I
            ADD CONSTRAINT %I %s
            ',
            foreign_key."childSchema",
            foreign_key."childTable",
            foreign_key."constraintName",
            foreign_key."definition"
        );
    END LOOP;
END;
$$;


DO $$
DECLARE
    remaining bigint;
BEGIN
    SELECT COUNT(*)
    INTO remaining
    FROM "_snowflake_map" mapping
    JOIN "_snowflake_tables" tables
        ON tables."schemaName" = mapping."schemaName"
        AND tables."tableName" = mapping."tableName";

    RAISE NOTICE
        'IDs migrados para Snowflake: %',
        remaining;
END;
$$;

COMMIT;