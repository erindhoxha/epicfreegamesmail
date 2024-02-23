document
  .getElementById("subscriptionForm")
  .addEventListener("submit", function (event) {
    event.preventDefault(); // Prevent the default form submission

    var emailInput = document.getElementById("email");
    var message = document.getElementById("subscriptionMessage");

    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(emailInput.value)) {
      // If email does not match the pattern, show an error
      message.textContent = "Please enter a valid email address.";
      message.style.display = "block";
      message.style.color = "red";
    } else {
      message.style.display = "none";
      emailInput.value = ""; // Clear the input
      insertEmail();
    }
  });
