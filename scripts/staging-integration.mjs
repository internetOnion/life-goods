import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
const root = fileURLToPath(new URL("../", import.meta.url))
const reader =
    "mongodb://test_reader:disposable_test_reader@127.0.0.1:37018/lifegoods_off_test?authSource=lifegoods_off_test"
const generated =
    "mongodb://test_generated:disposable_test_generated@127.0.0.1:37018/lifegoods_generated_test?authSource=lifegoods_generated_test"
const redis = "redis://:disposable_test_redis@127.0.0.1:36380/0"
const env = {
    ...process.env,
    LIFEGOODS_ENVIRONMENT: "development",
    LIFEGOODS_OFF_MONGODB_URI: reader,
    LIFEGOODS_OFF_MONGODB_DATABASE: "lifegoods_off",
    LIFEGOODS_GENERATED_MONGODB_URI: generated,
    LIFEGOODS_GENERATED_MONGODB_DATABASE: "lifegoods_generated_test",
    LIFEGOODS_REDIS_URL: redis,
    LIFEGOODS_TEST_OFF_MONGODB_READER_URI: reader,
    LIFEGOODS_TEST_OFF_MONGODB_WRITER_URI:
        "mongodb://test_writer:disposable_test_writer@127.0.0.1:37018/lifegoods_off_test?authSource=lifegoods_off_test",
    LIFEGOODS_TEST_GENERATED_MONGODB_URI: generated,
    LIFEGOODS_TEST_REDIS_URL: redis,
    LIFEGOODS_GEMINI_API_KEY: "",
    GEMINI_API_KEY: "",
}
const result = spawnSync(
    "uv",
    [
        "run",
        "--project",
        "backend",
        "pytest",
        "backend/tests",
        "--run-integration",
        "-m",
        "integration",
    ],
    { cwd: root, env, stdio: "inherit" },
)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
