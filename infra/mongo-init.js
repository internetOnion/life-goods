const database = db.getSiblingDB(process.env.LIFEGOODS_OFF_DATABASE)

database.createUser({
    user: process.env.LIFEGOODS_OFF_READER_USERNAME,
    pwd: process.env.LIFEGOODS_OFF_READER_PASSWORD,
    roles: [{ role: "read", db: process.env.LIFEGOODS_OFF_DATABASE }],
})

database.createUser({
    user: process.env.LIFEGOODS_OFF_WRITER_USERNAME,
    pwd: process.env.LIFEGOODS_OFF_WRITER_PASSWORD,
    roles: [{ role: "readWrite", db: process.env.LIFEGOODS_OFF_DATABASE }],
})

// Dataset-only deployments do not configure generated storage.
if (process.env.LIFEGOODS_GENERATED_DATABASE) {
    const generatedDatabase = db.getSiblingDB(
        process.env.LIFEGOODS_GENERATED_DATABASE,
    )

    generatedDatabase.createUser({
        user: process.env.LIFEGOODS_GENERATED_USERNAME,
        pwd: process.env.LIFEGOODS_GENERATED_PASSWORD,
        roles: [{ role: "readWrite", db: process.env.LIFEGOODS_GENERATED_DATABASE }],
    })

}
