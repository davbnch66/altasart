-- Fix BALAS clients with wrong email (contact@artlevage.fr is the company's own email, not the client's)
UPDATE clients SET email = 'cmasson@balas.net' WHERE id = '8dcb0b50-6794-42e2-ac0b-4008e0284baa' AND email = 'contact@artlevage.fr';
UPDATE clients SET email = 'cmasson@balas.net' WHERE id = '6d74ce46-94ba-4d29-9665-5202a1a0a0a6' AND email = 'contact@artlevage.fr';