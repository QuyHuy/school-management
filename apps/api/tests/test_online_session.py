import re
from app.infrastructure.utils.meet import generate_meet_link


def test_generate_meet_link_format():
    link = generate_meet_link()
    assert re.fullmatch(r"meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}", link)


def test_generate_meet_link_is_random():
    links = {generate_meet_link() for _ in range(20)}
    assert len(links) > 1
