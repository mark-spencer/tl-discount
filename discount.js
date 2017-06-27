(function() {
  //Add discount object to window namespace
  window.discount={};
  
  //Create a shorthand
  var discount=window.discount;
  
  //-----------------------------------------------------------------------------------------------------------------------
  //Condition checker: checks if an order/orderitem(s) quaifies for discount
  var orderCheckRule=function(order,condition) {
    //Check condition based on his type
    switch (condition.type) {
      case 'minimumRevenue':
        //Check customer revenue
        if (customDB.customer.query.revenue(order["customer-id"])>=condition.value) {
          return order;
        };
        break;
      case 'purchaseQuantity':
        //Look for orderitems that have valueHolder=valueToFind
        var aOrderItem=customDB.order.query.findItemsByValue(order.items,{valueHolder: condition.valueHolder, valueToFind: condition.value});
        //Filter on purchase quantity
        var aReason=[];
        aOrderItem.forEach(function(orderItem) {
          var quantityFrequency=Math.floor(orderItem.quantity/condition.quantity);
          if (quantityFrequency) {
            //Purchase quantity is met, add to the reason obj
            aReason.push({
              orderItem: orderItem,
              quantityFrequency: quantityFrequency 
            });
          };
        });
        if (aReason.length>0) {
          return aReason;
        };
      case 'minimumTotalPurchaseQuantity':
        //Look for orderitems that have valueHolder=valueToFind
        var aOrderItem=customDB.order.query.findItemsByValue(order.items,{valueHolder: condition.valueHolder, valueToFind: condition.value});
        if (aOrderItem.length) {
          //Make a total
          var totalQuantity=aOrderItem.reduce((acc,orderItem) => {return acc+orderItem.quantity},0);
          //Check if it matches the condition
          if (totalQuantity>=condition.minimumTotalQuantity) {
            return aOrderItem;
          };
        };
        break;
    };
    //Default: condition not met
    return false;
  }

  //Apply a discount
  var orderApplyRule=function(order,rule,conditionResult) {
    //Get the value(s) on which the discount applies
    var aAffected=[];
    switch (rule.discount.affecting) {
      case 'order.total':
        aAffected=[{object: order, property: 'total'}];
        break;
      case 'condition.item.quantity':
        conditionResult.forEach(function(conditionResult1) {
          aAffected.push({
            object: conditionResult1.orderItem,
            property: 'quantity',
            quantityFrequency: conditionResult1.quantityFrequency
          });
        });
        break;
      case 'condition.item:cheapest':
        var cheapestOrderItem={'unit-price': Infinity};
        conditionResult.forEach(function(orderItem) {
          if (orderItem['unit-price']<cheapestOrderItem['unit-price']) {
            cheapestOrderItem=orderItem;
          };
        });
        aAffected=[{object: cheapestOrderItem, property: 'unit-price'}];
        break;
    };
    //Calc the discount on the value(s)
    switch (rule.discount.type) {
      case '%':
        aAffected.forEach((affected) => {
          affected.value={old: (affected.object[affected.property])};
          affected.value.new=parseFloat((affected.value.old*((100-rule.discount.value)/100)).toFixed(2));
        });
        break;
      case '+':
        aAffected.forEach((affected) => {
          affected.value={old: (affected.object[affected.property])};
          affected.value.new=affected.value.old+(affected.quantityFrequency*rule.discount.value);
          //affected.value={old: (affected.object[affected.property])};
          //affected.value.new=parseFloat((affected.value.old*((100-rule.discount.value)/100)).toFixed(2));

          //discountResult.newValue=discountResult.origValue+(discountResult.match.frequency*discount.value);
        });
        break;
    };
    //Apply & add discount info on the order
    var recalcRequired=false;
    aAffected.forEach(function(affected) {
      //Apply
      affected.object[affected.property]=affected.value.new;
      //Inform
      if (!affected.object._discounts) {
        affected.object._discounts=[];
      };
      //Add discount info to the affected object
      var _discounts=affected.object._discounts;
      _discounts.push({
        reason: rule.description,
        changedProperty: affected.property,
        value: affected.value
      });
      recalcRequired=(affected.property=='unit-price');
    });
    //Recalc order?
    if (recalcRequired) {
      customDB.order.recalc(order);
    };
    //Mark the order as discounted
    order._hasDiscounts=true;
  };

  //Abstract rule object
  var abstractRule=function(options) {
    return {
      description: options.description,
      condition: options.condition,
      discount: options.discount,
      execute: function(order) {
        //Check if the condition for the discount applies
        var conditionResult=orderCheckRule(order,this.condition);
        if (conditionResult) {
          //Condition is met, apply discount!
          orderApplyRule(order,this,conditionResult);
        };
      }
    }
  };

  //System defined discountrules (can be extended...)
  var rule={
    minimumRevenue: function(options) {
      return abstractRule({
        description: options.description,
        condition: {
          type: 'minimumRevenue',
          value: options.minimumRevenue
        }, 
        discount: {
          value: options.discount.value,
          type: options.discount.type,
          affecting: 'order.total'
        }
      });
    },
    purchaseQuantityByProductCategory: function(options) {
      return abstractRule({
        description: options.description,
        condition: {
          type: 'purchaseQuantity',
          value: options.productCategory,
          valueHolder: customDB.product.query.getCategory,
          quantity: options.quantity
        },
        discount: {
          value: options.discount.value,
          type: options.discount.type,
          affecting: 'condition.item.quantity'
        }
      })
    },
    minimumTotalPurchaseQuantityByProductCategory: function(options) {
      return abstractRule({
        description: options.description,
        condition: {
          type: 'minimumTotalPurchaseQuantity',
          value: options.productCategory,
          valueHolder: customDB.product.query.getCategory,
          minimumTotalQuantity: options.minimumTotalQuantity
        },
        discount: {
          value: options.discount.value,
          type: options.discount.type,
          affecting: options.discount.affecting
        }
      })
    }
  }

  //Collection of active rules (can be loaded from a DB)
  //condition: sql expression...
  var ruleCat1Discount=rule.minimumTotalPurchaseQuantityByProductCategory({productCategory: '1', minimumTotalQuantity: 2, discount: {affecting: 'condition.item:cheapest', type: '%', value: 20}, description: 'If you buy two or more products of category "Tools" (id 1), you get a 20% discount on the cheapest product.'});
  var ruleCat2Discount=rule.purchaseQuantityByProductCategory({productCategory: '2', quantity: 5, discount: {type: '+', value: 1}, description: 'For every products of category "Switches" (id 2), when you buy five, you get a sixth for free.'});
  var ruleMinimumRevenueDiscount=rule.minimumRevenue({minimumRevenue: 1000, discount: {type: '%', value: 10}, description: 'A customer who has already bought for over 1000 EUR, gets a discount of 10% on the whole order.'});

  //Active discount rules (in order of execution!)
  var activeDiscountRules=[
    ruleCat1Discount,
    ruleCat2Discount,
    ruleMinimumRevenueDiscount
  ];
  
  //Calculate discount for an order by applying company rules
  discount.calculate=function(order) {
    //Make a copy of the order to apply the rule to
    var discountedOrder=Object.assign(order);
    discountedOrder._hasDiscounts=false;
    //Apply rules on !
    activeDiscountRules.forEach((discountRule) => discountRule.execute(discountedOrder));
    //Get back with the discounted order
    return discountedOrder;
  };

  //Test function
  discount.test=function(outputElement) {
    //Loop through all orders from DB
    customDB.order.data.forEach(function(order) {
      //Calculate the discount!
      var discountedOrder=discount.calculate(order);
      //Gather some info, show the object on the console
      console.log(discountedOrder);
      var html=[];
      html.push('<hr /><h1>Order '+order.id+'</h1>');
      //Show the order with the applied discounts & info
      if (discountedOrder._hasDiscounts) {
        discountedOrder.items.forEach(function(orderItem) {
          html.push('<div style="font-weight:bold;">&bull; Product '+orderItem['product-id']+'</div>');
          //Unit-price
          if (orderItem._discounts && orderItem._discounts.some((discount)=>discount.changedProperty=='unit-price')) {
            //Unit-price discount!
            html.push('<div><strike>'+orderItem._discounts.map((discount)=>discount.value.old).join(' -> ')+' EUR</strike> '+orderItem['unit-price']+' EUR: '+orderItem._discounts.map((discount)=>discount.reason).join(' -> ')+'</div>');
          } 
          else {
            //No discount on unit-price...
            html.push('<div>'+orderItem['unit-price']+' EUR</div>');
          };
          //Quantity
          if (orderItem._discounts && orderItem._discounts.some((discount)=>discount.changedProperty=='quantity')) {
            //Quantity discount!
            var origQty=orderItem._discounts[0].value.old;
            html.push('<div>x '+origQty+' (+'+(orderItem['quantity']-origQty)+' FREE): '+orderItem._discounts.map((discount)=>discount.reason).join(' -> ')+'</div>');
          } 
          else {
            //No discount on quantity...
            html.push('<div>x '+orderItem['quantity']+' EUR</div>');
          };
          //Total
          html.push('<div> = '+orderItem.total+' EUR</div>')
        });
      }
      else {
        html.push('<div>No discount.</div>');
      };
      //TOTAL
      html.push('<div style="margin-top:8px;"><u>TOTAL</u>: ');
      if (discountedOrder._discounts && discountedOrder._discounts.some((discount)=>discount.changedProperty=='total')) {
        html.push('<strike>'+discountedOrder._discounts.map((discount)=>discount.value.old).join(' -> ')+' EUR</strike> '+discountedOrder.total+' EUR: '+discountedOrder._discounts.map((discount)=>discount.reason).join(' -> '));
      }
      else {
        html.push(discountedOrder.total);
      };
      html.push('</div>');
      //Simple output system
      outputElement.innerHTML=outputElement.innerHTML+html.join('');
    });
  };
})()