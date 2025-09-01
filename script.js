body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f8f8f8;
}

#loading {
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 100;
    opacity: 0;
    animation: fadeIn 0.3s ease-in forwards;
}

#loading img {
    width: 80px;
    height: 80px;
    border-radius: 10px;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

#login-form {
    max-width: 400px;
    margin: 20px auto;
    padding: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    text-align: center;
}

#login-form h2 {
    margin-bottom: 20px;
}

#login-form input {
    display: block;
    width: 100%;
    margin: 10px 0;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
}

#login-form button {
    width: 100%;
    padding: 10px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
}

#login-form button:hover {
    background: #0056b3;
}

h1 {
    text-align: center;
    color: #333;
}

#cart, #stock-list {
    max-width: 800px;
    margin: 20px auto;
}

#cart {
    background: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

#cart-items {
    margin-bottom: 10px;
}

#place-order {
    width: 100%;
    padding: 10px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
}

#place-order:hover {
    background: #218838;
}

#place-order:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.item {
    border: 1px solid #ccc;
    padding: 10px;
    margin: 5px 0;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    transition: transform 0.2s;
}

.item:hover {
    transform: scale(1.02);
}

.item button {
    padding: 5px 10px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
}

.item button:hover {
    background: #218838;
}

#chat-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
}

#chat-button:hover {
    background: #0056b3;
}

/* Responsive design */
@media (max-width: 600px) {
    #loading img {
        width: 60px;
        height: 60px;
    }

    #login-form, #cart, #stock-list {
        padding: 10px;
    }

    #chat-button {
        bottom: 10px;
        right: 10px;
        padding: 8px 16px;
    }
}
