"""update_firm_model

Revision ID: 44a9b49468e1
Revises: 8f33d7dbc471
Create Date: 2026-10-17 14:03:14.987106

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '44a9b49468e1'
down_revision: Union[str, Sequence[str], None] = '8f33d7dbc471'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop foreign key from reporting_periods to firms.id
    op.execute("ALTER TABLE reporting_periods DROP CONSTRAINT IF EXISTS reporting_periods_firm_id_fkey")

    # 2. Add updated_at column to firms
    op.execute("ALTER TABLE firms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()")

    # 3. Drop default serial sequence on firms.id and cast to UUID using gen_random_uuid()
    op.execute("ALTER TABLE firms ALTER COLUMN id DROP DEFAULT")
    op.execute("ALTER TABLE firms ALTER COLUMN id TYPE UUID USING gen_random_uuid()")
    op.execute("ALTER TABLE firms ALTER COLUMN id SET DEFAULT gen_random_uuid()")

    # 4. Alter reporting_periods.firm_id to UUID
    op.execute("ALTER TABLE reporting_periods ALTER COLUMN firm_id TYPE UUID USING gen_random_uuid()")

    # 5. Re-create foreign key from reporting_periods to firms
    op.execute(
        "ALTER TABLE reporting_periods ADD CONSTRAINT reporting_periods_firm_id_fkey "
        "FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE"
    )

    # 6. Create index on owner_id
    op.execute("CREATE INDEX IF NOT EXISTS ix_firms_owner_id ON firms (owner_id)")


def downgrade() -> None:
    op.execute("ALTER TABLE reporting_periods DROP CONSTRAINT IF EXISTS reporting_periods_firm_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_firms_owner_id")
    op.execute("ALTER TABLE firms ALTER COLUMN id DROP DEFAULT")
    op.execute("ALTER TABLE firms ALTER COLUMN id TYPE INTEGER USING 1")
    op.execute("ALTER TABLE reporting_periods ALTER COLUMN firm_id TYPE INTEGER USING 1")
    op.execute(
        "ALTER TABLE reporting_periods ADD CONSTRAINT reporting_periods_firm_id_fkey "
        "FOREIGN KEY (firm_id) REFERENCES firms(id) ON DELETE CASCADE"
    )
    op.execute("ALTER TABLE firms DROP COLUMN IF EXISTS updated_at")
