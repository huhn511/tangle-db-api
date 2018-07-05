// routes/note_routes.js
module.exports = function(app) {

  const fs = require("fs");
  const util = require("util");
  const configFile = "config/db-config.json";

  const pubKeyFile = "config/pub.key";
  const privKeyFile = "config/priv.key";
  var path = require('path');
  const iotaHelper_1 = require("../helpers/iotaHelper");
  const IOTA = require("iota.lib.js");
  const crypto = require("crypto");

  const iota = new IOTA({
      provider: "http://nodes.iota.fm:80"
  });

  async function readConfigFile() {
    console.log(`Reading db-config.json`);
    const file = await util.promisify(fs.readFile)(path.join(configFile));
    return JSON.parse(file.toString());
  }

  async function signData(data) {
    delete data.sig;
    const json = JSON.stringify(data);
    const file = await util.promisify(fs.readFile)(path.join(privKeyFile));
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(json);
    return signer.sign(file.toString(), "hex");
}

  async function verifyData(data) {
    if (!data.sig) {
        return false;
    }
    else {
        const signature = data.sig;
        delete data.sig;
        const json = JSON.stringify(data);
        const publicKey = await util.promisify(fs.readFile)(path.join(pubKeyFile));
        const verifier = crypto.createVerify("RSA-SHA256");
        verifier.update(json);
        return verifier.verify(publicKey.toString(), signature, "hex");
    }
  }

  async function loadIndex(tableIndexHash) {
    console.log(`Loading Index from the Tangle`);
    if (!tableIndexHash || tableIndexHash.length === 0) {
        return {
            bundles: [],
            lastIdx: undefined
        };
    }
    else {
        const txObjects = await iotaHelper_1.IotaHelper.findTransactionObjectsAsync(iota, { bundles: [tableIndexHash] });
        const indexes = iotaHelper_1.IotaHelper.extractBundles(iota, txObjects);
        if (indexes && indexes.length > 0) {
            const currentIndex = indexes[0];
            const verified = await verifyData(currentIndex);
            if (!verified) {
                throw (new Error("ERROR Signature on index is invalid"));
            }
            currentIndex.bundles = currentIndex.bundles || [];
            return currentIndex;
        }
        else {
            return {
                bundles: [],
                lastIdx: undefined
            };
        }
    }
  }

  async function saveIndex(indexAddress, saveIdx, currentIndex) {
    console.log(`Saving Index to the Tangle`);
    saveIdx.lastIdx = currentIndex;
    saveIdx.sig = await signData(saveIdx);
    console.log(`Performing Proof of Work`);
    const txObjects = await iotaHelper_1.IotaHelper.sendTransferAsync(iota, "", 1, 15, [
        {
            address: indexAddress,
            value: 0,
            message: iota.utils.toTrytes(JSON.stringify(saveIdx)),
            tag: "INDEX9999999999999999999999"
        }
    ]);
    return txObjects[0].bundle;
  }

  async function writeConfigFile(config) {
    console.log(`Writing db-config.json`);
    await util.promisify(fs.writeFile)(path.join(configFile), JSON.stringify(config, undefined, "\t"));
  }

  async function index(table) {
    try {
        console.log(`command: index`);
        if (!table || table.length === 0) {
            throw new Error(`ERROR table is not valid: ${table}`);
        }
        const config = await readConfigFile();

        console.log("config", config);

        if (!config[table]) {
            throw new Error(`ERROR table '${table}' does not exits in db-config.json`);
        }
        const loadedIndex = await loadIndex(config[table].currentIndex);
        if (loadedIndex.bundles.length > 0) {
            console.log(`Index hashes:`);
            console.log(`\t${loadedIndex.bundles.join("\n\t")}`);
        }
        else {
            console.log("No index.");
        }
        console.log("loadedIndex", loadedIndex);
        return loadedIndex;
    }
    catch (err) {
        throw new Error(`ERROR Unable to load database table index:\n\n${err.stack}`);
    }
  }

  async function readItem(table, ids) {
    try {
        console.log(`command: read`);
        if (!table || table.length === 0) {
            throw new Error(`ERROR table is not valid: ${table}`);
        }
        const config = await readConfigFile();
        if (!config[table]) {
            throw new Error(`ERROR table '${table}' does not exits in db-config.json`);
        }
        let loadedIndex;
        if (ids) {
            loadedIndex = { bundles: ids.split(","), lastIdx: "" };
        }
        else {
            loadedIndex = await loadIndex(config[table].currentIndex);
        }
        console.log(`Reading items from Tangle`);
        const txObjects = await iotaHelper_1.IotaHelper.findTransactionObjectsAsync(iota, { bundles: loadedIndex.bundles });
        const objs = iotaHelper_1.IotaHelper.extractBundles(iota, txObjects);
        for (let i = 0; i < objs.length; i++) {
            const verified = await verifyData(objs[i]);
            if (!verified) {
                throw new Error("ERROR Signature on item is invalid");
            }
            console.log(JSON.stringify(objs[i], undefined, "\t"));
        }
        return objs;
    }
    catch (err) {
        throw new Error(`ERROR Unable to read item:\n\n${err.stack}`);
    }
  }

  async function createOrUpdateItem(table, data, id, tag = "") {
    try {
        console.log(`command: ${id ? "update" : "create"}`);
        const finalTag = ((tag || "") + "9".repeat(27)).substr(0, 27);
        if (!table || table.length === 0) {
            throw new Error(`ERROR table is not valid: ${table}`);
        }
        if (!data || data.length === 0) {
            throw new Error(`ERROR data is not valid: ${data}`);
        }
        if (!iota.valid.isTrytes(finalTag, 27)) {
            throw new Error(`ERROR tag is not valid: ${finalTag}`);
        }
        const config = await readConfigFile();
        if (!config[table]) {
            throw new Error(`ERROR table '${table}' does not exits in db-config.json`);
        }
        console.log(`Reading ${data}`);

        //const jsonFile = await util.promisify(fs.readFile)(data);

        const obj = data;
        obj.sig = await signData(obj);
        const ascii = iotaHelper_1.IotaHelper.encodeNonASCII(JSON.stringify(obj));
        console.log(`Adding Data to Tangle`);
        console.log(`Performing Proof of Work`);
        const txObjects = await iotaHelper_1.IotaHelper.sendTransferAsync(iota, "", 1, 15, [
            {
                address: config[table].dataAddress,
                value: 0,
                message: iota.utils.toTrytes(ascii),
                tag: finalTag
            }
        ]);
        console.log(`Item saved as bundle '${txObjects[0].bundle}'`);
        const loadedIndex = await loadIndex(config[table].currentIndex);
        if (id) {
            const idx = loadedIndex.bundles.indexOf(id);
            if (idx >= 0) {
                console.log(`Removing old hash from the index`);
                loadedIndex.bundles.splice(idx, 1);
            }
        }
        console.log(`Adding new hash to the index`);
        loadedIndex.bundles.push(txObjects[0].bundle);
        config[table].currentIndex = await saveIndex(config[table].indexAddress, loadedIndex, config[table].currentIndex);
        await writeConfigFile(config);
        console.log(`Item ${id ? "updated" : "added"}, you should be able to see the data on the tangle at the following link.`);
        console.log(`\tFirst Tx: https://thetangle.org/transaction/${txObjects[0].hash}`);
        console.log(`\tBundle: https://thetangle.org/bundle/${txObjects[0].bundle}`);
        console.log(`\nThe new index is available here.`);
        console.log(`\thttps://thetangle.org/bundle/${config[table].currentIndex}`);
        return txObjects[0].bundle;
    }
    catch (err) {
        throw new Error(`ERROR Unable to ${id ? "update" : "add"} item to the database:\n\n${err.stack}`);
    }
  }

  async function deleteItem(table, id) {
    try {
        console.log(`command: delete`);
        if (!table || table.length === 0) {
            throw new Error(`ERROR table is not valid: ${table}`);
        }
        if (!id || id.length === 0) {
            throw new Error(`ERROR id is not valid: ${id}`);
        }
        const config = await readConfigFile();
        if (!config[table]) {
            throw new Error(`ERROR table '${table}' does not exits in db-config.json`);
        }
        const loadedIndex = await loadIndex(config[table].currentIndex);
        const idx = loadedIndex.bundles.indexOf(id);
        if (idx >= 0) {
            console.log(`Removing hash from the index`);
            loadedIndex.bundles.splice(idx, 1);
            config[table].currentIndex = await saveIndex(config[table].indexAddress, loadedIndex, config[table].currentIndex);
            await writeConfigFile(config);
            console.log(`Deleted Item ${id}.`);
        }
        else {
            console.log(`Item ${id} is not in the current index.`);
        }
    }
    catch (err) {
        throw new Error(`ERROR Unable to remove item from the database:\n\n${err.stack}`);
    }
  }

  async function init(seed, tables) {
    try {
        console.log(`command: Initialise`);
        if (!iota.valid.isTrytes(seed, 81)) {
            throw new Error(`ERROR seed is not valid: ${seed}`);
        }
        if (!tables || tables.length === 0) {
            throw new Error(`ERROR tables is not valid: ${tables}`);
        }
        const tablesList = tables.split(",").map(t => t.trim());
        console.log(`seed: ${seed}`);
        console.log(`tables: ${tablesList.join(", ")}`);
        console.log(`Generating Addresses`);
        const config = {};
        const addresses = await iotaHelper_1.IotaHelper.getNewAddressAsync(iota, seed, {
            total: tablesList.length * 2,
            security: 2
        });
        for (let i = 0; i < tablesList.length; i++) {
            const tableName = tablesList[i];
            config[tableName] = {
                indexAddress: addresses[i * 2],
                dataAddress: addresses[(i * 2) + 1],
                currentIndex: ""
            };
            console.log(`\t${tableName} Index Address: ${config[tableName].indexAddress}`);
            console.log(`\t${tableName} Data Address: ${config[tableName].dataAddress}`);
        }
        await writeConfigFile(config);
        console.log(`Database initialised and db-config.json file written.`);
        return config;
    }
    catch (err) {
        throw new Error(`ERROR Unable to initialise database:\n\n${err.stack}`);
    }
  }

  // COLLECTION INIT
  app.post('/collections/init', (req, res) => {
    const seed = req.body.seed
    const collections = req.body.collections;

    console.log("COLLECTION INIT called", collections);

    if (fs.existsSync(path.join(configFile))) {
    // Do something
      console.log("already initialized", configFile);
      readConfigFile().then((data) => {
        res.send(data);
      })

    } else {
      init(seed, collections).then((data) => {
        console.log("init successfull", data);
        res.send(data);
      })
    }

  });

  // COLLECTION DELETE
  app.delete('/collections', (req, res) => {

    console.log("COLLECTION DELETE called");

    if (fs.existsSync(path.join(configFile))) {
    // Do something
      console.log("delete file", configFile);
      // delete file
      fs.unlinkSync(path.join(configFile));
      res.send({
        message: "config deleted"
      });

    } else {
      console.log("no config file found", configFile);
      res.send({
        message: "no config file found"
      });
    }

  });


  // INDEX
  app.get('/:collection_name', (req, res) => {
    const collection_name = req.params.collection_name;

    console.log("INDEX called", collection_name);
    index(collection_name).then((data) => {
      console.log("now?", data);
      res.send(data);
    });
  });

  // CREATE
  app.post('/:collection_name', (req, res) => {
    const collection_name = req.params.collection_name;
    const data = { ...req.body };

    console.log("CREATE called", req.params.collection_name);

    createOrUpdateItem(req.params.collection_name, data).then((bundleHash) => {
      console.log("bundleHash", bundleHash);
      res.send({
        bundleHash: bundleHash
      });
    });
  });

  // READ
  app.get('/:collection_name/:id', (req, res) => {
    const collection_name = req.params.collection_name;
    const id = req.params.id;

    console.log("READ called", collection_name);

    readItem(collection_name, id).then((data) => {
      console.log("data", data);
      res.send(data);
    });
  });

  // UPDATE
  app.put('/:collection_name/:id', (req, res) => {
    const collection_name = req.params.collection_name;
    const id = req.params.id;
    const note = { text: req.body.body, title: req.body.title };

    console.log("UPDATE called", collection_name);

    createOrUpdateItem(collection_name, note, id).then((data) => {
      console.log("data", data);
      res.send(data);
    });
  });

  // DELETE
  app.delete('/:collection_name/:id', (req, res) => {
    const collection_name = req.params.collection_name;
    const id = req.params.id;

    console.log("UPDATE called", collection_name);

    deleteItem('people', id).then((err) => {
      console.log("err", err);
      if(err){
        res.send(err);
      } else {
        res.send({
          message: 'successfully deleted!'
        });
      }

    });
  });
};
