#!/usr/bin/env python3
"""
start.py — ONE COMMAND, ONE PORT, EVERYTHING WORKS.
Generates SSL certs (first run only) → starts HTTPS server on 8443.

Usage:  python start.py
"""
import subprocess, socket, sys, os

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try: s.connect(("8.8.8.8", 80)); ip = s.getsockname()[0]
    except: ip = "127.0.0.1"
    finally: s.close()
    return ip

def generate_certs():
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import ipaddress, datetime
    except ImportError:
        print("Run: pip install cryptography"); sys.exit(1)
    local_ip = get_local_ip()
    os.makedirs("certs", exist_ok=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, local_ip),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "OPS Console"),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder()
        .subject_name(subject).issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now).not_valid_after(now + datetime.timedelta(days=365))
        .add_extension(x509.SubjectAlternativeName([
            x509.DNSName("localhost"),
            x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
            x509.IPAddress(ipaddress.IPv4Address(local_ip)),
        ]), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(key, hashes.SHA256()))
    with open("certs/server.key","wb") as f:
        f.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
    with open("certs/server.crt","wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    print(f"[OK] Certificates generated for {local_ip}")

def main():
    ip = get_local_ip()
    if not os.path.exists("certs/server.key"):
        print("[*] First run — generating SSL certificates...")
        generate_certs()
    print()
    print("=" * 55)
    print("   OPS::CONSOLE")
    print("=" * 55)
    print(f"   PC:         https://localhost:8443")
    print(f"   Quest:      https://{ip}:8443")
    print(f"   Ctrl+C to stop")
    print("=" * 55)
    print()
    subprocess.run([sys.executable, "-m", "uvicorn", "server:app",
        "--host", "0.0.0.0", "--port", "8443",
        "--ssl-keyfile", "certs/server.key", "--ssl-certfile", "certs/server.crt"])

if __name__ == "__main__":
    main()
