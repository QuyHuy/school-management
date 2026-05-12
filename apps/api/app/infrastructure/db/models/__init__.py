from app.infrastructure.db.models.attendance import (  # noqa: F401
    AttendanceRecordModel,
    ClassSessionModel,
)
from app.infrastructure.db.models.class_ import (  # noqa: F401
    ClassModel,
    ClassScheduleModel,
    EnrollmentModel,
)
from app.infrastructure.db.models.exam import ExamModel, GradeModel  # noqa: F401
from app.infrastructure.db.models.notification import FeedbackModel, NotificationModel  # noqa: F401
from app.infrastructure.db.models.student import StudentModel  # noqa: F401
from app.infrastructure.db.models.user import OrganizationModel, UserModel  # noqa: F401
from app.infrastructure.db.models.zalo import ZaloBindingModel  # noqa: F401
