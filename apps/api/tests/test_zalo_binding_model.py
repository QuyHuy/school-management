from app.infrastructure.db.models.zalo import ZaloBindingModel


def test_zalo_binding_tablename():
    assert ZaloBindingModel.__tablename__ == "zalo_bindings"


def test_zalo_binding_required_columns():
    cols = {c.key for c in ZaloBindingModel.__table__.columns}
    assert {"id", "organization_id", "user_id", "zalo_user_id", "is_following", "bound_at", "updated_at"} <= cols
