"""update_uploaded_documents_model

Revision ID: f5df3a457e4d
Revises: 44a9b49468e1
Create Date: 2026-10-17 17:51:42.143519

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5df3a457e4d'
down_revision: Union[str, Sequence[str], None] = '44a9b49468e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop foreign keys referencing uploaded_documents.id
    op.execute("ALTER TABLE electricity_records DROP CONSTRAINT IF EXISTS electricity_records_source_document_id_fkey")
    op.execute("ALTER TABLE fuel_records DROP CONSTRAINT IF EXISTS fuel_records_source_document_id_fkey")
    op.execute("ALTER TABLE material_records DROP CONSTRAINT IF EXISTS material_records_source_document_id_fkey")

    # 2. Add DOCX to fileformat enum
    op.execute("ALTER TYPE fileformat ADD VALUE IF NOT EXISTS 'DOCX'")

    # 3. Add created_at and updated_at to uploaded_documents
    op.execute("ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()")
    op.execute("ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()")

    # 4. Alter uploaded_documents.id to UUID
    op.execute("ALTER TABLE uploaded_documents ALTER COLUMN id DROP DEFAULT")
    op.execute("ALTER TABLE uploaded_documents ALTER COLUMN id TYPE UUID USING gen_random_uuid()")
    op.execute("ALTER TABLE uploaded_documents ALTER COLUMN id SET DEFAULT gen_random_uuid()")

    # 5. Alter source_document_id on activity tables to UUID
    op.execute("ALTER TABLE electricity_records ALTER COLUMN source_document_id TYPE UUID USING NULL")
    op.execute("ALTER TABLE fuel_records ALTER COLUMN source_document_id TYPE UUID USING NULL")
    op.execute("ALTER TABLE material_records ALTER COLUMN source_document_id TYPE UUID USING NULL")

    # 6. Re-create foreign keys
    op.execute(
        "ALTER TABLE electricity_records ADD CONSTRAINT electricity_records_source_document_id_fkey "
        "FOREIGN KEY (source_document_id) REFERENCES uploaded_documents(id) ON DELETE SET NULL"
    )
    op.execute(
        "ALTER TABLE fuel_records ADD CONSTRAINT fuel_records_source_document_id_fkey "
        "FOREIGN KEY (source_document_id) REFERENCES uploaded_documents(id) ON DELETE SET NULL"
    )
    op.execute(
        "ALTER TABLE material_records ADD CONSTRAINT material_records_source_document_id_fkey "
        "FOREIGN KEY (source_document_id) REFERENCES uploaded_documents(id) ON DELETE SET NULL"
    )

    # 7. Add index on reporting_period_id
    op.execute("CREATE INDEX IF NOT EXISTS ix_uploaded_documents_reporting_period_id ON uploaded_documents (reporting_period_id)")


def downgrade() -> None:
    op.execute("ALTER TABLE electricity_records DROP CONSTRAINT IF EXISTS electricity_records_source_document_id_fkey")
    op.execute("ALTER TABLE fuel_records DROP CONSTRAINT IF EXISTS fuel_records_source_document_id_fkey")
    op.execute("ALTER TABLE material_records DROP CONSTRAINT IF EXISTS material_records_source_document_id_fkey")

    op.execute("DROP INDEX IF EXISTS ix_uploaded_documents_reporting_period_id")
    op.execute("ALTER TABLE uploaded_documents DROP COLUMN IF EXISTS updated_at")
    op.execute("ALTER TABLE uploaded_documents DROP COLUMN IF EXISTS created_at")
    op.execute("ALTER TABLE uploaded_documents ALTER COLUMN id DROP DEFAULT")
    op.execute("ALTER TABLE uploaded_documents ALTER COLUMN id TYPE INTEGER USING 1")

    op.execute("ALTER TABLE electricity_records ALTER COLUMN source_document_id TYPE INTEGER USING NULL")
    op.execute("ALTER TABLE fuel_records ALTER COLUMN source_document_id TYPE INTEGER USING NULL")
    op.execute("ALTER TABLE material_records ALTER COLUMN source_document_id TYPE INTEGER USING NULL")

    op.execute(
        "ALTER TABLE electricity_records ADD CONSTRAINT electricity_records_source_document_id_fkey "
        "FOREIGN KEY (source_document_id) REFERENCES uploaded_documents(id) ON DELETE SET NULL"
    )
    op.execute(
        "ALTER TABLE fuel_records ADD CONSTRAINT fuel_records_source_document_id_fkey "
        "FOREIGN KEY (source_document_id) REFERENCES uploaded_documents(id) ON DELETE SET NULL"
    )
    op.execute(
        "ALTER TABLE material_records ADD CONSTRAINT material_records_source_document_id_fkey "
        "FOREIGN KEY (source_document_id) REFERENCES uploaded_documents(id) ON DELETE SET NULL"
    )
