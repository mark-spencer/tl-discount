(function() {
  //Add db object to window namespace
  window.customDB={};
  
  //Shorthand
  var customDB=window.customDB;
  
  //==============================================================================================================
  //Products
  //==============================================================================================================
  customDB.product={
    data: [
      {
        "id": "A101",
        "description": "Screwdriver",
        "category": "1",
        "price": "9.75"
      },
      {
        "id": "A102",
        "description": "Electric screwdriver",
        "category": "1",
        "price": "49.50"
      },
      {
        "id": "B101",
        "description": "Basic on-off switch",
        "category": "2",
        "price": "4.99"
      },
      {
        "id": "B102",
        "description": "Press button",
        "category": "2",
        "price": "4.99"
      },
      {
        "id": "B103",
        "description": "Switch with motion detector",
        "category": "2",
        "price": "12.95"
      }
    ],
    query: {
      findById(productId) {
        var foundProduct=null;
        customDB.product.data.some((product) => {
          if (product.id==productId) {
            foundProduct=product;
            return true;
          };
        })
        return foundProduct;
      },
      getCategory(productId) {
        var product=customDB.product.query.findById(productId);
        if (product) {
          return product.category;
        };
      }
    }
  };

  //==============================================================================================================
  //Customers
  //==============================================================================================================
  customDB.customer={
    data: [
      {
        "id": "1",
        "name": "Coca Cola",
        "since": "2014-06-28",
        "revenue": 492.12
      },
      {
        "id": "2",
        "name": "Teamleader",
        "since": "2015-01-15",
        "revenue": 1505.95
      },
      {
        "id": "3",
        "name": "Jeroen De Wit",
        "since": "2016-02-11",
        "revenue": 0
      }
    ],
    query: {
      findById(customerId) {
        var foundCustomer=null;
        customDB.customer.data.some((customer) => {
          if (customer.id==customerId) {
            foundCustomer=customer;
            return true;
          };
        })
        return foundCustomer;
      },
      revenue(customerId) {
        var customer=customDB.customer.query.findById(customerId);
        return (customer ? customer.revenue : null);
      }
    }
  };

  //==============================================================================================================
  //Orders
  //==============================================================================================================
  customDB.order={
    data: [
      {
        "id": "1",
        "customer-id": "1",
        "items": [
          {
            "product-id": "B102",
            "quantity": 10,
            "unit-price": 4.99,
            "total": 49.90
          }
        ],
        "total": 49.90
      },
      {
        "id": "2",
        "customer-id": "2",
        "items": [
          {
            "product-id": "B102",
            "quantity": 5,
            "unit-price": 4.99,
            "total": 24.95
          }
        ],
        "total": 24.95
      },
      {
        "id": "3",
        "customer-id": "3",
        "items": [
          {
            "product-id": "A101",
            "quantity": 2,
            "unit-price": 9.75,
            "total": 19.50
          },
          {
            "product-id": "A102",
            "quantity": 1,
            "unit-price": 49.50,
            "total": 49.50
          }
        ],
        "total": 69.00
      }    
    ],
    recalc(order) {
      order.total=0;
      order.items.forEach(function(orderItem) {
        orderItem.total=orderItem['unit-price']*orderItem.quantity;
        order.total=order.total+orderItem.total;
      });
    },
    query: {
      totalProductQuantity(orderItems,filter) {
          var aOrderItem=customDB.order.query.findItemsByValue(orderItems,filter);
          return (aOrderItem.length==0) ? 0 : aOrderItem.reduce((prevValue,orderItem) => prevValue+orderItem.quantity,0);;
      },
      findItemsByValue(orderItems,filter) {
        //Search in order for items that match a criteria (valueHolder can be a property or a function)
        return orderItems.filter((orderItem) => {
          var itemValue=(typeof filter.valueHolder=='function') ? filter.valueHolder(orderItem["product-id"]) : orderItem[filter.valueHolder];
          return (itemValue==filter.valueToFind);
        });
      },
      findItemsWithMinimumQuantity(orderItems,filter) {
          var aOrderItem=customDB.order.query.findItemsByValue(orderItems,filter);
          return aOrderItem.filter((orderItem) => (orderItem.quantity>=filter.quantity));
      }
    }
  };

})()