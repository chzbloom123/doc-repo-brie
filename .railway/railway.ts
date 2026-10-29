import { defineRailway, github, project, service } from "railway/iac";
// Manage web-service settings only. PostgreSQL, its backup schedule, and the
// private music bucket are retained independently. Secrets stay in Railway.
export const partial = "doc-repo-brie";
export default defineRailway(() => {
  const docRepoBrie = service("doc-repo-brie", {
    source: github("chzbloom123/doc-repo-brie", { branch: "main", checkSuites: false }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "/Dockerfile" },
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    replicas: { "us-west2": 1 },
    // Railway's default restart policy is ON_FAILURE.
    deploy: { restartPolicyMaxRetries: 3 },
  });

  return project("WGOB Dark O'Clock Radio", {
    variables: { managed: false },
    resources: [docRepoBrie],
  });
});
