# tangle-db-api

This peoject creates a Database in the Tangle. 
You can also CRUD on entries or list them all. 

Clone the repository, install dependencies and run the dev node server.

```
$ git clone https://github.com/huhn511/tangle-db-api
$ cd tangle-db-api
$ npm install
$ npm run dev
```

## API

### Setup the database
To create a new database, you have to send the following data with a POST request to /collections/init 

#### POST
* seed: (string) for generating addresses for indexes
* collections: (string) list of collections you want to create. Seperated with comma. (Example: "users, pets")
```
http://localhost:8080/collections/init
```

### Delete the database

#### DELTE
```
http://localhost:8080/collections/
```

### Index
List all indexes of your collection name. 
#### GET
```
http://localhost:8080/:collection_name/
```
For Example: http://localhost:8080/users/

### Show
Returns the saved object with the given index hash from the collection

#### GET
```
http://localhost:8080/:collection_name/:index_hash
```
For Example: http://localhost:8080/users/9H9NCLCKBCHSLBCWUFFIHROZLDRWFDFFHFRTPWKNEQD9HJWVYOCJJSJBSICDYZJVGOSQFABK9KKAYOTKZ


### Create
Create a new entry to the given collection with the provided data.

#### POST
```
http://localhost:8080/:collection_name/
```
For Example: http://localhost:8080/users/


### Update
Updates a entry in the given collection with the provided data.

#### PUT
```
http://localhost:8080/:collection_name/:index_hash
```
For Example: http://localhost:8080/users/9H9NCLCKBCHSLBCWUFFIHROZLDRWFDFFHFRTPWKNEQD9HJWVYOCJJSJBSICDYZJVGOSQFABK9KKAYOTKZ

### Delete
Deletes a entry in the given collection.

#### DELETE
```
http://localhost:8080/:collection_name/:index_hash
```
For Example: http://localhost:8080/users/9H9NCLCKBCHSLBCWUFFIHROZLDRWFDFFHFRTPWKNEQD9HJWVYOCJJSJBSICDYZJVGOSQFABK9KKAYOTKZ



