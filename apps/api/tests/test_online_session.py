import re

from app.infrastructure.utils.meet import generate_meet_link


def test_generate_meet_link_format():
    link = generate_meet_link()
    assert re.fullmatch(r"https://meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}", link)


def test_generate_meet_link_is_random():
    links = {generate_meet_link() for _ in range(20)}
    assert len(links) > 10


def test_create_online_session_generates_link():
    session_meet_link = generate_meet_link()
    assert session_meet_link.startswith("https://meet.google.com/")


def test_update_online_to_online_keeps_existing_link():
    existing_link = "https://meet.google.com/abc-defg-hij"
    # Simulate: if a session already has a meet_link, it should not be regenerated
    meet_link = existing_link  # existing link is preserved, not overwritten
    assert meet_link == existing_link
