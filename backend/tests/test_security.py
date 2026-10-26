"""Unit tests for the helpers behind phone signup and session tokens."""

from datetime import datetime, timezone

from app.security import (
    create_token,
    decode_token,
    generate_otp,
    hash_otp,
    mask_phone,
    normalize_phone,
    otp_expiry,
    valid_phone,
)


def test_normalize_phone_keeps_digits_and_a_single_plus():
    assert normalize_phone("+966 50-000-0001") == "+966500000001"
    assert normalize_phone("++966+500000001") == "+966500000001"
    assert normalize_phone("00966500000001") == "00966500000001"


def test_valid_phone_bounds():
    assert valid_phone("+966500000001") is True
    assert valid_phone("1234567") is True
    assert valid_phone("+12") is False
    assert valid_phone("+1234567890123456") is False
    assert valid_phone("") is False


def test_hash_otp_is_bound_to_the_phone():
    first = hash_otp("+966500000001", "123456")
    assert len(first) == 64
    assert first == hash_otp("+966500000001", "123456")
    assert first != hash_otp("+966500000002", "123456")
    assert first != hash_otp("+966500000001", "123457")


def test_generate_otp_is_six_digits():
    code = generate_otp()
    assert len(code) == 6
    assert code.isdigit()


def test_tokens_round_trip_and_reject_garbage():
    token = create_token("user-1")
    assert decode_token(token) == "user-1"
    assert decode_token("not-a-token") is None
    assert decode_token("") is None


def test_mask_phone_hides_the_middle():
    assert mask_phone("+966500000001") == "+966***001"
    assert mask_phone("123") == "123"


def test_otp_expiry_is_in_the_future():
    remaining = otp_expiry() - datetime.now(timezone.utc)
    assert 0 < remaining.total_seconds() <= 5 * 60
