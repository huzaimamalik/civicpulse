"""Create the complaints schema.

Revision ID: 20260926_0001
Revises:
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260926_0001"
down_revision = None
branch_labels = None
depends_on = None

category_enum = postgresql.ENUM(
    "water", "electricity", "sanitation", "roads", "streetlights", "other",
    name="category_enum", create_type=False,
)
priority_enum = postgresql.ENUM("high", "normal", "low", name="priority_enum", create_type=False)
status_enum = postgresql.ENUM(
    "open", "in_progress", "resolved", "rejected", name="status_enum", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    category_enum.create(bind, checkfirst=True)
    priority_enum.create(bind, checkfirst=True)
    status_enum.create(bind, checkfirst=True)

    existing_table = sa.inspect(bind).has_table("complaints")
    if existing_table:
        op.execute("ALTER TABLE complaints ALTER COLUMN id TYPE UUID USING id::uuid")
        op.execute("ALTER TABLE complaints ALTER COLUMN category TYPE category_enum USING category::category_enum")
        op.execute("ALTER TABLE complaints ALTER COLUMN priority TYPE priority_enum USING priority::priority_enum")
        op.execute("ALTER TABLE complaints ALTER COLUMN status TYPE status_enum USING status::status_enum")
        op.execute("ALTER TABLE complaints ALTER COLUMN status SET DEFAULT 'open'")
        op.execute(
            "ALTER TABLE complaints ADD CONSTRAINT ck_complaints_text_length "
            "CHECK (char_length(text) BETWEEN 10 AND 2000)"
        )
        op.execute(
            "ALTER TABLE complaints ADD CONSTRAINT ck_complaints_location_length "
            "CHECK (char_length(location) BETWEEN 3 AND 200)"
        )
        op.execute(
            "ALTER TABLE complaints ADD CONSTRAINT ck_complaints_triaged_by "
            "CHECK (triaged_by IN ('llm:groq', 'llm:ollama', 'rules', 'rules:fallback'))"
        )
    else:
        op.create_table(
            "complaints",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("location", sa.String(length=200), nullable=False),
            sa.Column("reporter_contact", sa.String(length=255), nullable=True),
            sa.Column("category", category_enum, nullable=False),
            sa.Column("priority", priority_enum, nullable=False),
            sa.Column("status", status_enum, server_default="open", nullable=False),
            sa.Column("ai_summary", sa.String(length=140), nullable=True),
            sa.Column("triaged_by", sa.String(length=30), nullable=False),
            sa.Column("triage_latency_ms", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.CheckConstraint("char_length(text) BETWEEN 10 AND 2000", name="ck_complaints_text_length"),
            sa.CheckConstraint("char_length(location) BETWEEN 3 AND 200", name="ck_complaints_location_length"),
            sa.CheckConstraint(
                "triaged_by IN ('llm:groq', 'llm:ollama', 'rules', 'rules:fallback')",
                name="ck_complaints_triaged_by",
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    op.execute("CREATE INDEX IF NOT EXISTS ix_complaints_status_priority ON complaints (status, priority)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_complaints_created_at ON complaints (created_at)")

    op.execute(
        """
        CREATE OR REPLACE FUNCTION touch_complaints_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER complaints_updated_at_trigger
        BEFORE UPDATE ON complaints
        FOR EACH ROW EXECUTE FUNCTION touch_complaints_updated_at();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS complaints_updated_at_trigger ON complaints")
    op.execute("DROP FUNCTION IF EXISTS touch_complaints_updated_at()")
    op.drop_index("ix_complaints_created_at", table_name="complaints")
    op.drop_index("ix_complaints_status_priority", table_name="complaints")
    op.drop_table("complaints")
    status_enum.drop(op.get_bind(), checkfirst=True)
    priority_enum.drop(op.get_bind(), checkfirst=True)
    category_enum.drop(op.get_bind(), checkfirst=True)
