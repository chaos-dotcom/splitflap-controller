# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability within the Split-Flap Display Controller, please send an email to [your-email@example.com](mailto:your-email@example.com). All security vulnerabilities will be promptly addressed.

Please include the following information in your report:
- Type of vulnerability
- Steps to reproduce the issue
- Affected versions
- Potential impact

## Security Considerations

### MQTT Security

This application connects to MQTT brokers which may control physical hardware. Please consider the following security measures:

1. **Use TLS/SSL**: Configure your MQTT broker to use encrypted connections (mqtts://)
2. **Strong Authentication**: Always use username/password authentication for your MQTT broker
3. **Access Control Lists (ACLs)**: Restrict topic access on your MQTT broker
4. **Network Segmentation**: Keep your MQTT broker on a separate network from the internet

### API Tokens

The application uses the National Rail Enquiries API which requires an API token. Protect this token:

1. Never commit API tokens to your repository
2. Use environment variables to store sensitive credentials
3. Rotate API tokens periodically

### Docker Deployment

When deploying with Docker:

1. Keep your Docker host and containers updated with security patches
2. Use non-root users inside containers where possible
3. Consider using Docker secrets for sensitive information
4. Restrict network access to only required ports

### Web Security

The web interface should be secured if exposed beyond your local network:

1. Use HTTPS with a valid certificate
2. Consider implementing authentication if the interface is publicly accessible
3. Keep all dependencies updated to patch security vulnerabilities

## Dependency Management

This project relies on various npm packages. To ensure security:

1. Regularly run `npm audit` to check for vulnerabilities
2. Keep dependencies updated
3. Consider using tools like Dependabot to automate security updates

## Secure Configuration

1. Always change default credentials
2. Limit network exposure of the application to trusted networks
3. Review the `.env` file regularly to ensure no sensitive data is exposed
