/*DB Operations */
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/pizzaflitza');

// create a schema
var Schema = mongoose.Schema;
var orderSchema = new Schema({
    order_at: Date,
    user_data: {
    recipientId: String,
    first_name: String,
    last_name: String,
    gender: String,
    locale: String,
    timezone: String
   },
  order: {
    pizza: String,
   },
   location: {
    title: String,
    coordinates: {
      lat: String,
      long: String
        }
   }
  
});

// create a model 
var Order = mongoose.model('Order', orderSchema);

// make this available in our Node applications
module.exports = Order;