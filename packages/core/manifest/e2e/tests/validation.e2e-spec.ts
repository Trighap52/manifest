import { ValidationError } from 'class-validator'

describe('Validation (e2e)', () => {
  describe('Validation behavior', () => {
    it('nothing is mandatory by default', async () => {
      const response = await global.request.post('/collections/dogs').send({})
      expect(response.status).toBe(201)
    })

    it('all defined properties are type validated', async () => {
      const dogWithAllValuesOfWrongType = {
        name: 123,
        age: true,
        website: 123,
        description: 0,
        birthdate: false,
        price: '100',
        isGoodBoy: 'true',
        acquiredAt: false,
        email: 123,
        favoriteToy: 123,
        location: '{ lat: 12, lng: 13 }'
      }

      const response = await global.request
        .post('/collections/dogs')
        .send(dogWithAllValuesOfWrongType)

      expect(response.status).toBe(400)
      expect(response.body.length).toBe(
        Object.keys(dogWithAllValuesOfWrongType).length
      )
    })

    it('all defined properties are validated against the validation object if exists', async () => {
      const car = {
        model: 'slow car',
        brand: 'A very long brand name that should not be accepted',
        year: 1500
      }

      const response = await global.request.post('/collections/cars').send(car)

      expect(response.status).toBe(400)
      expect(response.body.length).toBe(Object.keys(car).length)
    })

    it('isOptional skips validation if the value is undefined or null', async () => {
      const carWithoutYear = {
        model: 'turbo speed car',
        brand: 'example brand'
      }

      const response = await global.request
        .post('/collections/cars')
        .send(carWithoutYear)

      expect(response.status).toBe(201)
    })

    it('validation in the property object is prioritized over validation object', async () => {
      const car = {
        model: 'double turbo truck',
        brand: 'example brand',
        year: 2000
      }

      const response = await global.request.post('/collections/cars').send(car)

      expect(response.status).toBe(201)
    })

    it('update validation is the same as create validation', async () => {
      const createResponse = await global.request
        .post('/collections/cars')
        .send({
          model: 'double turbo truck',
          brand: 'example brand',
          year: 2000
        })

      const goodCar = {
        model: 'double turbo truck',
        brand: 'example brand',
        year: 2000
      }

      const badCar = {
        model: 'slow car',
        brand: 'A very long brand name that should not be accepted',
        year: 1500
      }

      const goodResponse = await global.request
        .put('/collections/cars/' + createResponse.body.id)
        .send(goodCar)
      const badResponse = await global.request
        .put('/collections/cars/' + createResponse.body.id)
        .send(badCar)

      expect(goodResponse.status).toBe(200)
      expect(badResponse.status).toBe(400)
    })

    it('email and password are required for authenticable entities', async () => {
      const superUserWithoutEmailAndPassword = {
        name: 'cool super user'
      }

      const response = await global.request
        .post('/collections/super-users')
        .send(superUserWithoutEmailAndPassword)

      expect(response.status).toBe(400)
      expect(
        response.body.filter(
          (error: ValidationError) => error.property === 'email'
        ).length
      ).toBe(1)
      expect(
        response.body.filter(
          (error: ValidationError) => error.property === 'password'
        ).length
      ).toBe(1)
    })

    it('required is an alias of isNotEmpty validator', async () => {
      const superUserWithoutName = {
        email: 'test@test.fr',
        password: 'password'
      }

      const response = await global.request
        .post('/collections/super-users')
        .send(superUserWithoutName)

      expect(response.status).toBe(400)
      expect(
        response.body.filter(
          (error: ValidationError) => error.property === 'name'
        ).length
      ).toBe(1)
    })

    it('validators that expect booleans as context do nothing if value is false', async () => {
      const superUser = {
        name: 'cool super user',
        email: 'test@test.fr',
        password: 'password'
      }

      const response = await global.request
        .post('/collections/super-users')
        .send(superUser)

      expect(response.status).toBe(201)
    })

    it('password type fields are optional on update but mandatory on create', async () => {
      const superUserWithoutPassword = {
        email: 'example@manifest.build',
        name: 'cool super user'
      }

      const badCreateResponse = await global.request
        .post('/collections/super-users')
        .send(superUserWithoutPassword)

      const goodCreateResponse = await global.request
        .post('/collections/super-users')
        .send({ ...superUserWithoutPassword, password: 'password' })

      const updateResponse = await global.request
        .put(`/collections/super-users/${goodCreateResponse.body.id}`)
        .send({ name: 'new name', email: 'example2@manifest.build' })

      expect(badCreateResponse.status).toBe(400)
      expect(
        badCreateResponse.body.filter(
          (error: ValidationError) => error.property === 'password'
        ).length
      ).toBe(1)

      expect(goodCreateResponse.status).toBe(201)
      expect(updateResponse.status).toBe(200)
    })
  })

  it('should validate nested entities properties', async () => {
    const goodTutorial = {
      title: 'Test tutorial',
      content: 'This is a test tutorial',
      steps: [
        {
          title: 'Step 1',
          description: 'This is the first step'
        },
        {
          title: 'Step 2',
          description: 'This is the second step'
        }
      ]
    }

    const badTutorial = {
      title: 'Test tutorial',
      content: 'This is a test tutorial',
      steps: [
        {
          title: 'Step 1',
          description: 'This is the first step'
        },
        {
          title: 'A',
          description: 'This is the second step'
        }
      ]
    }

    const goodResponse = await global.request
      .post('/collections/tutorials')
      .send(goodTutorial)

    const badResponse = await global.request
      .post('/collections/tutorials')
      .send(badTutorial)

    expect(goodResponse.status).toBe(201)
    expect(badResponse.status).toBe(400)
    expect(badResponse.body.length).toBe(1)
    expect(badResponse.body[0].property).toBe('steps[1].title')
    expect(badResponse.body[0].constraints).toHaveProperty('minLength')
  })
})
