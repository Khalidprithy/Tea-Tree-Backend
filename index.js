const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const res = require('express/lib/response');
const { decode } = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const app = express();

require('dotenv').config();

// Middleware

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.snscaf3.mongodb.net/?retryWrites=true&w=majority`

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


// Verify jwt token

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}



async function run() {
    try {
        await client.connect();
        const productsCollection = client.db('teatree').collection('products');
        const purchaseCollection = client.db('teatree').collection('purchase');
        const reviewsCollection = client.db('teatree').collection('reviews');
        const clientsCollection = client.db('teatree').collection('clients');
        const usersCollection = client.db('teatree').collection('users');
        const paymentsCollection = client.db('teatree').collection('payments');

        // Verify admin 

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                res.status(403).send({ message: 'Forbidden action' })
            }
        }

        // PRODUCTS API

        // Get all products
        app.get('/products', async (req, res) => {
            const query = {};
            const cursor = productsCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        })

        // Find one product
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await productsCollection.findOne(query);
            // console.log(product)
            res.send(product);
        })

        // Add one product
        app.post('/products', verifyJWT, verifyAdmin, async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result)
        })

        // USER API

        // Load all user
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users)
        })
        app.get('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const users = await usersCollection.findOne({ email: email }).toArray();
            res.send(users)
        })

        // Find Admin
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        // Make Admin
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updatedDoc = {
                $set: { role: 'admin' },
            };
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);

        })

        // Add new user
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
            res.send({ result, token });
        })



        // PURCHASE API

        // Make Order
        app.post('/purchase', async (req, res) => {
            const purchase = req.body;
            const query = { product: purchase.name, product: purchase.email }
            // console.log(query)
            const exists = await purchaseCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, purchase: exists })
            }
            const result = await purchaseCollection.insertOne(purchase);
            return res.send({ success: true, result });
        })

        // Find one user's orders by email
        app.get('/purchase', async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email };
                const myOrders = await purchaseCollection.find(query).toArray();
                return res.send(myOrders);
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' })
            }
        })

        // Load all orders
        app.get('/allOrder', async (req, res) => {
            const orders = await purchaseCollection.find().toArray();
            console.log(orders)
            res.send(orders);
        })

        // Delete an order
        app.delete('/purchase/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = purchaseCollection.deleteOne(query);
            res.send(result);
        })

        // Find an order by ID
        app.get('/purchase/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const payment = await purchaseCollection.findOne(query);
            res.send(payment);
        })

        app.patch('/purchase/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentsCollection.insertOne(payment);
            const updatedPurchase = await purchaseCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc)

        })

        // REVIEWS API Need to work on it

        // Load all reviews
        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = reviewsCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        })

        // Add review
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            res.send(result)
        })


        // CLIENT API

        // Load all clients
        app.get('/clients', async (req, res) => {
            const query = {};
            const cursor = clientsCollection.find(query);
            const clients = await cursor.toArray();
            res.send(clients);
        })

        // PAYMENT API

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const product = req.body;
            const price = product.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })

        })

    }
    finally {

    }

}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello TeaTree')
})

app.listen(port, () => {
    console.log(`Tea Tree app listening on port ${port}`)
})

