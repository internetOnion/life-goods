db.getSiblingDB("lifegoods_off_test").createUser({
    user: "test_reader",
    pwd: "disposable_test_reader",
    roles: [
        { role: "read", db: "lifegoods_off_test" },
        { role: "read", db: "lifegoods_off" },
    ],
})
db.getSiblingDB("lifegoods_off_test").createUser({
    user: "test_writer",
    pwd: "disposable_test_writer",
    roles: [{ role: "readWrite", db: "lifegoods_off_test" }],
})
db.getSiblingDB("lifegoods_generated_test").createUser({
    user: "test_generated",
    pwd: "disposable_test_generated",
    roles: [{ role: "readWrite", db: "lifegoods_generated_test" }],
})
