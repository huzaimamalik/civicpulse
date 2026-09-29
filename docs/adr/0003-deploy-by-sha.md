# ADR 0003: Deploy by commit SHA

Status: Accepted

## Context

CivicPulse publishes backend and frontend container images through GitHub Actions. Deploying a mutable tag such as `latest` would make it difficult to determine exactly which source revision is running and would make rollback less reliable.

## Decision

Production deployments use container images identified by the Git commit SHA. The CD workflow builds and publishes both images with `${{ github.sha }}` and updates the production Kubernetes deployment to use that SHA tag.

The `latest` tag may also be published for convenience, but it is never used as the deployment reference.

## Consequences

- Every deployment can be traced directly to one Git commit.
- The running version can be reproduced and audited.
- Rollback can be performed by redeploying a previously known SHA.
- Image references are immutable from the application's deployment perspective.
- The CD pipeline must pass the exact commit SHA into the production manifests before deployment.