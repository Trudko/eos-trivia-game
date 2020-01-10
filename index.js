const { Api, JsonRpc} = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextEncoder, TextDecoder } = require('util');
const ecc = require('eosjs-ecc');
const fetch = require('node-fetch');
const express = require('express');
const bodyParser = require('body-parser');

// Connect to local EOS testnet
const defaultPrivateKey = process.env.PRIVATE_KEY;
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);
const rpc = new JsonRpc('http://127.0.0.1:8888', { fetch });
const api = new Api({
  rpc,
  signatureProvider,
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder()
});

const questionBank = {
  'Who is the inventor of Bitcoin': 'Satoshi Nakamoto',
  'How many satoshis are in a bitcoin': '100000000',
  'What is the current coinbase reward (in BTC) for mining a block': '12.5'
};
const questionsList = Object.keys(questionBank);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// endpoint to get a question from the server
app.get('/question', (req, res) => {
  res.send(questionsList[Math.floor(Math.random() * questionsList.length)]);
});

// payable endpoint that pays user if answer is correct
app.post('/play', async (req, res) => {
  const { question, answer, payoutAccount, signature } = req.body;
  await sendTransaction(payoutAccount, 'bob', '3.0000');

  if (answer.toLowerCase() === questionBank[question].toLowerCase()) {
    const payoutAccountInfo = await rpc.get_account(payoutAccount);
    const permissions = payoutAccountInfo.permissions.find(
      permission => permission.perm_name === 'api'
    );
    const publicKey = permissions.required_auth.keys[0].key;

    try {
      const verification = ecc.verify(signature, answer, publicKey);

      if (!verification) {
        res.end('Incorrect signature');
      }

      await sendTransaction('bob', payoutAccount, '6.0000');
      res.end('Correct response!');
    } catch (err) {
      res.status(500);
      res.end(err.message);
    }
  } else {
    res.end('Incorrect response.');
  }
});

// function to create EOS transaction to transfer funds
const sendTransaction = async (from, to, quantity) => {
  return api.transact(
    {
      actions: [
        {
          account: 'eosio.token',
          name: 'transfer',
          authorization: [
            {
              actor: from,
              permission: 'active'
            }
          ],
          data: {
            from: from,
            to: to,
            quantity: `${quantity} SYS`,
            memo: ''
          }
        }
      ]
    },
    {
      blocksBehind: 3,
      expireSeconds: 30
    }
  );
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
